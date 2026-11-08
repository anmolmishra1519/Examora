from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user, require_faculty
from app.database import get_db
from app.models.models import Answer, AttemptStatus, Exam, ExamAttempt, User
from app.schemas.schemas import ManualGrade, ResultOut
from app.services.audit import log_action
from app.services.grading import grade_attempt

router = APIRouter(prefix="/results", tags=["results"])


def _result_out(attempt: ExamAttempt) -> ResultOut:
    r = attempt.result
    return ResultOut(
        attempt_id=attempt.id, student_name=attempt.student.full_name, exam_title=attempt.exam.title,
        total_marks=r.total_marks if r else attempt.exam.total_marks,
        marks_obtained=r.marks_obtained if r else 0, correct_count=r.correct_count if r else 0,
        incorrect_count=r.incorrect_count if r else 0, unanswered_count=r.unanswered_count if r else 0,
        pending_manual_grading=r.pending_manual_grading if r else 0,
        percentage=r.percentage if r else 0, passed=r.passed if r else None,
        released=r.released if r else False,
    )


@router.get("")
def list_results(exam_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found")

    if user.role.value == "faculty":
        if exam.faculty_id != user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
        attempts = [a for a in exam.attempts if a.status in (AttemptStatus.submitted, AttemptStatus.auto_submitted)]
        results = [_result_out(a) for a in attempts]
        scores = [r.marks_obtained for r in results]
        return {
            "exam_id": exam.id, "exam_title": exam.title, "total_students": len(exam.attempts),
            "submitted": len(attempts), "not_submitted": len(exam.attempts) - len(attempts),
            "average_score": round(sum(scores) / len(scores), 2) if scores else 0,
            "highest_score": max(scores) if scores else 0, "lowest_score": min(scores) if scores else 0,
            "pass_percentage": round(sum(1 for r in results if r.passed) / len(results) * 100, 1) if results else 0,
            "results": results,
        }

    attempt = next((a for a in exam.attempts if a.student_id == user.id), None)
    if not attempt or not attempt.result or not attempt.result.released:
        return {"exam_id": exam.id, "exam_title": exam.title, "results": []}
    return {"exam_id": exam.id, "exam_title": exam.title, "results": [_result_out(attempt)]}


@router.get("/{attempt_id}", response_model=ResultOut)
def get_result(attempt_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Result not found")
    if user.role.value == "student":
        if attempt.student_id != user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
        if not attempt.result or not attempt.result.released:
            raise HTTPException(status_code=404, detail="Result has not been released yet")
    elif user.role.value == "faculty" and attempt.exam.faculty_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return _result_out(attempt)


@router.get("/{attempt_id}/answers")
def get_attempt_answers(attempt_id: str, user: User = Depends(require_faculty), db: Session = Depends(get_db)):
    """Full per-question breakdown for grading - includes the reference
    answer/correct_answer so faculty can grade descriptive responses."""
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    if not attempt or attempt.exam.faculty_id != user.id:
        raise HTTPException(status_code=404, detail="Attempt not found")

    answers_by_q = {a.question_id: a for a in attempt.answers}
    items = []
    for section in attempt.exam.sections:
        for q in section.questions:
            a = answers_by_q.get(q.id)
            items.append({
                "answer_id": a.id if a else None,
                "question_id": q.id,
                "section_name": section.name,
                "question_text": q.question_text,
                "question_type": q.question_type.value,
                "marks": q.marks,
                "correct_answer": q.correct_answer,
                "response": a.response if a else None,
                "is_answered": a.is_answered if a else False,
                "is_correct": a.is_correct if a else None,
                "marks_awarded": a.marks_awarded if a else None,
                "manually_graded": a.manually_graded if a else False,
                "grader_note": a.grader_note if a else None,
            })
    return {
        "attempt_id": attempt.id, "student_name": attempt.student.full_name,
        "exam_title": attempt.exam.title, "items": items,
    }


@router.post("/{exam_id}/release")
def release_results(exam_id: str, user: User = Depends(require_faculty), db: Session = Depends(get_db)):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam or exam.faculty_id != user.id:
        raise HTTPException(status_code=404, detail="Examination not found")

    released_count = 0
    for attempt in exam.attempts:
        if attempt.result and attempt.status in (AttemptStatus.submitted, AttemptStatus.auto_submitted):
            attempt.result.released = True
            attempt.result.released_at = datetime.utcnow()
            released_count += 1
    db.commit()
    log_action(db, user, "Result Released", "Exam", exam.id, {"count": released_count})
    return {"detail": f"{released_count} result(s) released"}


@router.post("/answers/{answer_id}/grade")
def grade_descriptive_answer(answer_id: str, payload: ManualGrade, user: User = Depends(require_faculty), db: Session = Depends(get_db)):
    answer = db.query(Answer).filter(Answer.id == answer_id).first()
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found")
    attempt = answer.attempt
    if attempt.exam.faculty_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if payload.marks_awarded > answer.question.marks:
        raise HTTPException(status_code=400, detail=f"Marks cannot exceed the question's maximum of {answer.question.marks}")

    answer.marks_awarded = payload.marks_awarded
    answer.manually_graded = True
    answer.grader_note = payload.grader_note
    answer.is_correct = payload.marks_awarded >= answer.question.marks
    db.commit()

    grade_attempt(db, attempt, attempt.exam)
    log_action(db, user, "Descriptive Answer Graded", "Answer", answer.id, {"marks": payload.marks_awarded})
    return {"detail": "graded"}
