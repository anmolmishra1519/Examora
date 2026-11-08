from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.auth.deps import require_faculty
from app.database import get_db
from app.models.models import Exam, ExamAttempt, User
from app.services.audit import log_action
from app.services.reports import exam_report_csv, exam_report_pdf, student_integrity_report_pdf

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/exam/{exam_id}")
def exam_report_json(exam_id: str, user: User = Depends(require_faculty), db: Session = Depends(get_db)):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam or exam.faculty_id != user.id:
        raise HTTPException(status_code=404, detail="Examination not found")

    from app.models.models import AttemptStatus
    submitted = [a for a in exam.attempts if a.status in (AttemptStatus.submitted, AttemptStatus.auto_submitted)]
    scores = [a.result.marks_obtained for a in submitted if a.result]
    passed = sum(1 for a in submitted if a.result and a.result.passed)
    risk_dist = {"low": 0, "medium": 0, "high": 0}
    for a in submitted:
        if a.proctor_sessions and a.proctor_sessions[0].risk_assessment:
            risk_dist[a.proctor_sessions[0].risk_assessment.risk_level] += 1

    return {
        "exam_id": exam.id, "title": exam.title, "subject": exam.subject,
        "total_students": len(exam.attempts), "submitted": len(submitted),
        "not_submitted": len(exam.attempts) - len(submitted),
        "average_score": round(sum(scores) / len(scores), 2) if scores else 0,
        "highest_score": max(scores) if scores else 0, "lowest_score": min(scores) if scores else 0,
        "pass_percentage": round(passed / len(submitted) * 100, 1) if submitted else 0,
        "integrity_distribution": risk_dist,
        "score_distribution": scores,
    }


@router.get("/exam/{exam_id}/pdf")
def exam_report_pdf_download(exam_id: str, user: User = Depends(require_faculty), db: Session = Depends(get_db)):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam or exam.faculty_id != user.id:
        raise HTTPException(status_code=404, detail="Examination not found")
    pdf_bytes = exam_report_pdf(exam, exam.attempts)
    log_action(db, user, "Report Exported (PDF)", "Exam", exam.id)
    return Response(content=pdf_bytes, media_type="application/pdf",
                     headers={"Content-Disposition": f'attachment; filename="{exam.title}-report.pdf"'})


@router.get("/exam/{exam_id}/csv")
def exam_report_csv_download(exam_id: str, user: User = Depends(require_faculty), db: Session = Depends(get_db)):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam or exam.faculty_id != user.id:
        raise HTTPException(status_code=404, detail="Examination not found")
    csv_bytes = exam_report_csv(exam, exam.attempts)
    log_action(db, user, "Report Exported (CSV)", "Exam", exam.id)
    return Response(content=csv_bytes, media_type="text/csv",
                     headers={"Content-Disposition": f'attachment; filename="{exam.title}-report.csv"'})


@router.get("/student/{attempt_id}")
def student_integrity_report_json(attempt_id: str, user: User = Depends(require_faculty), db: Session = Depends(get_db)):
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    if not attempt or attempt.exam.faculty_id != user.id:
        raise HTTPException(status_code=404, detail="Attempt not found")

    session = attempt.proctor_sessions[0] if attempt.proctor_sessions else None
    risk = session.risk_assessment if session else None
    return {
        "attempt_id": attempt.id, "student_name": attempt.student.full_name, "exam_title": attempt.exam.title,
        "risk": {"score": risk.score, "risk_level": risk.risk_level, "reasons": risk.reasons} if risk else None,
        "event_count": len(session.events) if session else 0,
    }


@router.get("/student/{attempt_id}/pdf")
def student_integrity_report_pdf_download(attempt_id: str, user: User = Depends(require_faculty), db: Session = Depends(get_db)):
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    if not attempt or attempt.exam.faculty_id != user.id:
        raise HTTPException(status_code=404, detail="Attempt not found")
    pdf_bytes = student_integrity_report_pdf(attempt.exam, attempt)
    log_action(db, user, "Student Integrity Report Exported", "ExamAttempt", attempt.id)
    return Response(content=pdf_bytes, media_type="application/pdf",
                     headers={"Content-Disposition": f'attachment; filename="{attempt.student.full_name}-integrity-report.pdf"'})
