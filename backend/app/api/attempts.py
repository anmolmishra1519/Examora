from __future__ import annotations

import random
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user, require_student
from app.database import get_db
from app.models.models import (
    Answer, AttemptStatus, Exam, ExamAttempt, ExamStatus, Question, User,
)
from app.schemas.schemas import (
    AnswerSave, AttemptDetailOut, AttemptOut, AttemptQuestionOut, AttemptStart, OptionOut,
)
from app.services.audit import log_action
from app.services.grading import grade_attempt

router = APIRouter(prefix="/attempts", tags=["attempts"])


def _seconds_remaining(attempt: ExamAttempt) -> int:
    if not attempt.server_end_time:
        return 0
    delta = (attempt.server_end_time - datetime.utcnow()).total_seconds()
    return max(0, int(delta))


def _get_owned_attempt(db: Session, attempt_id: str, user: User) -> ExamAttempt:
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if user.role.value == "student" and attempt.student_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if user.role.value == "faculty" and attempt.exam.faculty_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return attempt


@router.post("", response_model=AttemptOut)
def start_attempt(payload: AttemptStart, user: User = Depends(require_student), db: Session = Depends(get_db)):
    exam = db.query(Exam).filter(Exam.id == payload.exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found")
    if exam.status not in (ExamStatus.live, ExamStatus.scheduled):
        raise HTTPException(status_code=400, detail="This examination is not currently available")
    if not payload.consent_given:
        raise HTTPException(status_code=400, detail="Consent to the monitoring notice is required to begin")

    existing = (
        db.query(ExamAttempt)
        .filter(ExamAttempt.exam_id == exam.id, ExamAttempt.student_id == user.id)
        .first()
    )
    if existing:
        if existing.status == AttemptStatus.in_progress and _seconds_remaining(existing) > 0:
            return AttemptOut(
                id=existing.id, exam_id=existing.exam_id, status=existing.status.value,
                server_start_time=existing.server_start_time, server_end_time=existing.server_end_time,
                seconds_remaining=_seconds_remaining(existing),
            )
        if existing.status in (AttemptStatus.submitted, AttemptStatus.auto_submitted):
            raise HTTPException(status_code=400, detail="You have already submitted this examination")
        if existing.status == AttemptStatus.in_progress:
            existing.status = AttemptStatus.expired
            db.commit()
            raise HTTPException(status_code=400, detail="Your previous session for this examination has expired")

    question_order = None
    if exam.randomize_questions:
        all_ids = [q.id for s in exam.sections for q in sorted(s.questions, key=lambda x: x.order)]
        random.shuffle(all_ids)
        question_order = all_ids

    now = datetime.utcnow()
    attempt = ExamAttempt(
        exam_id=exam.id, student_id=user.id, status=AttemptStatus.in_progress,
        server_start_time=now, server_end_time=now + timedelta(minutes=exam.duration_minutes),
        consent_given=True, question_order=question_order,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    log_action(db, user, "Student Started Exam", "ExamAttempt", attempt.id, {"exam_id": exam.id})

    return AttemptOut(
        id=attempt.id, exam_id=attempt.exam_id, status=attempt.status.value,
        server_start_time=attempt.server_start_time, server_end_time=attempt.server_end_time,
        seconds_remaining=_seconds_remaining(attempt),
    )


@router.get("/{attempt_id}", response_model=AttemptDetailOut)
def get_attempt(attempt_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    attempt = _get_owned_attempt(db, attempt_id, user)
    exam = attempt.exam

    remaining = _seconds_remaining(attempt)
    if attempt.status == AttemptStatus.in_progress and remaining == 0:
        _auto_submit(db, attempt, exam)

    answers_by_q = {a.question_id: a for a in attempt.answers}
    all_questions: list[Question] = [q for s in exam.sections for q in s.questions]
    section_names = {s.id: s.name for s in exam.sections}

    if attempt.question_order:
        order_map = {qid: i for i, qid in enumerate(attempt.question_order)}
        all_questions.sort(key=lambda q: order_map.get(q.id, 999))
    else:
        all_questions.sort(key=lambda q: (section_names.get(q.section_id, ""), q.order))

    questions_out = []
    for q in all_questions:
        options = sorted(q.options, key=lambda o: o.order)
        if exam.randomize_options and q.question_type.value in ("mcq", "multi_select"):
            options = options[:]
            random.shuffle(options)
        answer = answers_by_q.get(q.id)
        questions_out.append(AttemptQuestionOut(
            id=q.id, section_id=q.section_id, section_name=section_names.get(q.section_id, ""),
            question_text=q.question_text, question_type=q.question_type.value, marks=q.marks, order=q.order,
            options=[OptionOut(id=o.id, label=o.label, text=o.text, order=o.order) for o in options],
            response=answer.response if answer else None,
            marked_for_review=answer.marked_for_review if answer else False,
            is_answered=answer.is_answered if answer else False,
        ))

    return AttemptDetailOut(
        id=attempt.id, exam_id=exam.id, exam_title=exam.title, exam_subject=exam.subject,
        status=attempt.status.value, server_start_time=attempt.server_start_time,
        server_end_time=attempt.server_end_time, seconds_remaining=remaining,
        duration_minutes=exam.duration_minutes, total_marks=exam.total_marks,
        proctoring_enabled=exam.proctoring_enabled, allow_mark_for_review=exam.allow_mark_for_review,
        questions=questions_out,
    )


@router.put("/{attempt_id}/answers")
def save_answer(attempt_id: str, payload: AnswerSave, user: User = Depends(require_student), db: Session = Depends(get_db)):
    attempt = _get_owned_attempt(db, attempt_id, user)
    if attempt.status != AttemptStatus.in_progress:
        raise HTTPException(status_code=400, detail="This examination session is no longer active")
    if _seconds_remaining(attempt) == 0:
        _auto_submit(db, attempt, attempt.exam)
        raise HTTPException(status_code=400, detail="Time is up - your examination has been automatically submitted")

    answer = db.query(Answer).filter(Answer.attempt_id == attempt.id, Answer.question_id == payload.question_id).first()
    is_answered = payload.response is not None and payload.response != "" and payload.response != []
    if answer is None:
        answer = Answer(attempt_id=attempt.id, question_id=payload.question_id)
        db.add(answer)

    answer.response = payload.response
    answer.marked_for_review = payload.marked_for_review
    answer.is_answered = is_answered
    answer.updated_at = datetime.utcnow()
    db.commit()

    return {"detail": "saved", "seconds_remaining": _seconds_remaining(attempt)}


@router.post("/{attempt_id}/submit")
def submit_attempt(attempt_id: str, user: User = Depends(require_student), db: Session = Depends(get_db)):
    attempt = _get_owned_attempt(db, attempt_id, user)
    if attempt.status in (AttemptStatus.submitted, AttemptStatus.auto_submitted):
        raise HTTPException(status_code=400, detail="This examination has already been submitted")
    if attempt.status != AttemptStatus.in_progress:
        raise HTTPException(status_code=400, detail="This examination session cannot be submitted")

    attempt.status = AttemptStatus.submitted
    attempt.submitted_at = datetime.utcnow()
    db.commit()
    db.refresh(attempt)

    grade_attempt(db, attempt, attempt.exam)
    log_action(db, user, "Student Submitted Exam", "ExamAttempt", attempt.id)

    return {"detail": "submitted", "attempt_id": attempt.id}


def _auto_submit(db: Session, attempt: ExamAttempt, exam: Exam):
    if attempt.status != AttemptStatus.in_progress:
        return
    attempt.status = AttemptStatus.auto_submitted
    attempt.submitted_at = datetime.utcnow()
    db.commit()
    db.refresh(attempt)
    grade_attempt(db, attempt, exam)
    log_action(db, None, "Exam Auto-Submitted (time expired)", "ExamAttempt", attempt.id)
