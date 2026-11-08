from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user, require_faculty, require_student
from app.config import get_settings
from app.database import get_db
from app.models.models import (
    AttemptStatus, EventType, Exam, ExamAttempt, ProctorEvent, ProctorSession, User,
)
from app.schemas.schemas import ProctorEventIn, ProctorEventOut, ProctorSessionStart, RiskOut
from app.services.risk_engine import is_duplicate_within_cooldown, label_for, recompute_risk, severity_for

router = APIRouter(prefix="/proctor", tags=["proctor"])
settings = get_settings()


@router.post("/sessions")
def start_session(payload: ProctorSessionStart, user: User = Depends(require_student), db: Session = Depends(get_db)):
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == payload.attempt_id).first()
    if not attempt or attempt.student_id != user.id:
        raise HTTPException(status_code=404, detail="Attempt not found")

    session = ProctorSession(attempt_id=attempt.id, mode=settings.PROCTORING_MODE)
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"session_id": session.id, "mode": session.mode}


@router.post("/events", response_model=ProctorEventOut | None)
def record_event(payload: ProctorEventIn, user: User = Depends(require_student), db: Session = Depends(get_db)):
    if payload.event_type not in EventType.__members__:
        raise HTTPException(status_code=400, detail="Unknown event type")

    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == payload.attempt_id).first()
    if not attempt or attempt.student_id != user.id:
        raise HTTPException(status_code=404, detail="Attempt not found")
    session = db.query(ProctorSession).filter(ProctorSession.id == payload.session_id, ProctorSession.attempt_id == attempt.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Proctoring session not found")
    if attempt.status != AttemptStatus.in_progress:
        return None

    now = datetime.utcnow()
    if is_duplicate_within_cooldown(db, session.id, payload.event_type, now):
        return None  # part of the same ongoing incident - not a new event

    event = ProctorEvent(
        session_id=session.id, exam_id=attempt.exam_id, attempt_id=attempt.id, student_id=user.id,
        event_type=EventType(payload.event_type), severity=severity_for(payload.event_type),
        confidence=max(0.0, min(1.0, payload.confidence)), timestamp=now,
        duration_seconds=payload.duration_seconds,
        description=payload.description or label_for(payload.event_type),
        evidence_reference=payload.evidence_reference,
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    recompute_risk(db, session)

    return ProctorEventOut.model_validate(event)


@router.get("/sessions/{session_id}")
def get_session(session_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.query(ProctorSession).filter(ProctorSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    attempt = session.attempt
    if user.role.value == "student" and attempt.student_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if user.role.value == "faculty" and attempt.exam.faculty_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    risk = session.risk_assessment
    return {
        "session_id": session.id,
        "attempt_id": attempt.id,
        "mode": session.mode,
        "started_at": session.started_at,
        "risk": RiskOut(score=risk.score, risk_level=risk.risk_level, reasons=risk.reasons) if risk else None,
        "events": [ProctorEventOut.model_validate(e) for e in sorted(session.events, key=lambda x: x.timestamp)],
    }


@router.get("/events")
def list_events(exam_id: str | None = None, attempt_id: str | None = None,
                 user: User = Depends(require_faculty), db: Session = Depends(get_db)):
    query = db.query(ProctorEvent)
    if exam_id:
        query = query.filter(ProctorEvent.exam_id == exam_id)
    if attempt_id:
        query = query.filter(ProctorEvent.attempt_id == attempt_id)
    events = query.order_by(ProctorEvent.timestamp.desc()).all()
    events = [e for e in events if e.exam.faculty_id == user.id]
    return [ProctorEventOut.model_validate(e) for e in events]


@router.get("/live/{exam_id}")
def live_monitoring(exam_id: str, user: User = Depends(require_faculty), db: Session = Depends(get_db)):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam or exam.faculty_id != user.id:
        raise HTTPException(status_code=404, detail="Examination not found")

    cards = []
    normal = under_review = high = 0
    for attempt in exam.attempts:
        if attempt.status not in (AttemptStatus.in_progress, AttemptStatus.submitted, AttemptStatus.auto_submitted):
            continue
        session = attempt.proctor_sessions[0] if attempt.proctor_sessions else None
        risk = session.risk_assessment if session else None
        score = risk.score if risk else 100
        level = risk.risk_level if risk else "low"
        event_count = len(session.events) if session else 0

        if level == "high":
            high += 1
        elif level == "medium":
            under_review += 1
        else:
            normal += 1

        cards.append({
            "attempt_id": attempt.id,
            "student_id": attempt.student_id,
            "student_name": attempt.student.full_name,
            "status": attempt.status.value,
            "integrity_score": score,
            "risk_level": level,
            "event_count": event_count,
            "warnings": sum(1 for e in (session.events if session else []) if e.event_type.value in ("TAB_SWITCH", "WINDOW_BLUR", "FULLSCREEN_EXIT")),
            "session_id": session.id if session else None,
        })

    return {
        "exam_id": exam.id,
        "exam_title": exam.title,
        "active_students": len(cards),
        "normal": normal,
        "under_review": under_review,
        "high_risk": high,
        "students": cards,
    }
