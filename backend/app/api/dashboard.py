from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.deps import require_faculty, require_student
from app.database import get_db
from app.models.models import AttemptStatus, Enrollment, Exam, ExamAttempt, ExamStatus, User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/faculty")
def faculty_dashboard(user: User = Depends(require_faculty), db: Session = Depends(get_db)):
    exams = db.query(Exam).filter(Exam.faculty_id == user.id).order_by(Exam.created_at.desc()).all()

    active = [e for e in exams if e.status == ExamStatus.live]
    upcoming = [e for e in exams if e.status == ExamStatus.scheduled]
    completed = [e for e in exams if e.status == ExamStatus.completed]

    total_students = len({a.student_id for e in exams for a in e.attempts})

    all_attempts = [a for e in exams for a in e.attempts if a.status in (AttemptStatus.submitted, AttemptStatus.auto_submitted)]
    scores = [a.result.percentage for a in all_attempts if a.result]
    passed = sum(1 for a in all_attempts if a.result and a.result.passed)
    high_risk = sum(1 for a in all_attempts if a.proctor_sessions and a.proctor_sessions[0].risk_assessment and a.proctor_sessions[0].risk_assessment.risk_level == "high")

    recent = sorted(exams, key=lambda e: e.created_at, reverse=True)[:6]

    return {
        "active_exams": len(active),
        "upcoming_exams": len(upcoming),
        "completed_exams": len(completed),
        "total_students": total_students,
        "average_completion": round(len(all_attempts) / sum(len({a.student_id for a in e.attempts}) or 1 for e in exams) * 100, 1) if exams else 0,
        "average_score": round(sum(scores) / len(scores), 1) if scores else 0,
        "pass_percentage": round(passed / len(all_attempts) * 100, 1) if all_attempts else 0,
        "high_risk_attempts": high_risk,
        "recent_exams": [
            {
                "id": e.id, "title": e.title, "subject": e.subject, "status": e.status.value,
                "exam_date": e.exam_date, "student_count": len({a.student_id for a in e.attempts}),
            }
            for e in recent
        ],
    }


@router.get("/student")
def student_dashboard(user: User = Depends(require_student), db: Session = Depends(get_db)):
    enrolled_course_ids = {e.course_id for e in db.query(Enrollment).filter(Enrollment.student_id == user.id)}
    exams = (
        db.query(Exam)
        .filter(Exam.status != ExamStatus.draft)
        .all()
    )
    exams = [e for e in exams if e.course_id is None or e.course_id in enrolled_course_ids]

    my_attempts = {a.exam_id: a for a in db.query(ExamAttempt).filter(ExamAttempt.student_id == user.id)}

    upcoming, completed = [], []
    for e in exams:
        attempt = my_attempts.get(e.id)
        if attempt and attempt.status in (AttemptStatus.submitted, AttemptStatus.auto_submitted):
            completed.append({
                "id": e.id, "title": e.title, "subject": e.subject,
                "exam_date": e.exam_date, "score": attempt.result.marks_obtained if attempt.result else None,
                "total_marks": e.total_marks,
                "result_status": ("Pass" if attempt.result and attempt.result.passed else "Fail" if attempt.result and attempt.result.passed is False else "Pending Evaluation"),
                "released": attempt.result.released if attempt.result else False,
            })
        elif e.status in (ExamStatus.live, ExamStatus.scheduled):
            upcoming.append({
                "id": e.id, "title": e.title, "subject": e.subject, "exam_date": e.exam_date,
                "duration_minutes": e.duration_minutes, "total_marks": e.total_marks,
                "status": e.status.value,
                "in_progress": bool(attempt and attempt.status == AttemptStatus.in_progress),
            })

    return {"upcoming_exams": upcoming, "completed_exams": completed}
