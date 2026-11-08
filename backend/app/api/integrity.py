from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.deps import require_faculty
from app.database import get_db
from app.models.models import (
    AttemptFinalReview, FacultyReview, FinalReviewStatus, ProctorEvent, ReviewStatus, User,
)
from app.schemas.schemas import EventReviewIn, FinalReviewIn, ProctorEventOut, RiskOut
from app.services.audit import log_action

router = APIRouter(prefix="/integrity", tags=["integrity"])


@router.get("/attempts/{attempt_id}")
def get_attempt_integrity(attempt_id: str, user: User = Depends(require_faculty), db: Session = Depends(get_db)):
    from app.models.models import ExamAttempt
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    if not attempt or attempt.exam.faculty_id != user.id:
        raise HTTPException(status_code=404, detail="Attempt not found")

    session = attempt.proctor_sessions[0] if attempt.proctor_sessions else None
    risk = session.risk_assessment if session else None
    final_review = db.query(AttemptFinalReview).filter(AttemptFinalReview.attempt_id == attempt.id).first()

    events = []
    if session:
        for e in sorted(session.events, key=lambda x: x.timestamp):
            item = ProctorEventOut.model_validate(e).model_dump()
            item["review"] = None
            if e.review:
                item["review"] = {"decision": e.review.decision.value, "notes": e.review.notes, "faculty_id": e.review.faculty_id}
            events.append(item)

    return {
        "attempt_id": attempt.id,
        "student_id": attempt.student_id,
        "student_name": attempt.student.full_name,
        "exam_id": attempt.exam_id,
        "exam_title": attempt.exam.title,
        "status": attempt.status.value,
        "risk": RiskOut(score=risk.score, risk_level=risk.risk_level, reasons=risk.reasons) if risk else None,
        "events": events,
        "final_review": {
            "status": final_review.status.value, "notes": final_review.notes,
        } if final_review else {"status": "normal", "notes": None},
    }


@router.post("/events/{event_id}/review")
def review_event(event_id: str, payload: EventReviewIn, user: User = Depends(require_faculty), db: Session = Depends(get_db)):
    event = db.query(ProctorEvent).filter(ProctorEvent.id == event_id).first()
    if not event or event.exam.faculty_id != user.id:
        raise HTTPException(status_code=404, detail="Event not found")
    if payload.decision not in ReviewStatus.__members__:
        raise HTTPException(status_code=400, detail="Invalid decision")

    review = event.review
    if review is None:
        review = FacultyReview(event_id=event.id, faculty_id=user.id, decision=ReviewStatus(payload.decision), notes=payload.notes)
        db.add(review)
    else:
        review.decision = ReviewStatus(payload.decision)
        review.notes = payload.notes
        review.faculty_id = user.id

    event.review_status = ReviewStatus(payload.decision)
    db.commit()
    log_action(db, user, "Faculty Reviewed Event", "ProctorEvent", event.id, {"decision": payload.decision})
    return {"detail": "reviewed"}


@router.post("/attempts/{attempt_id}/final-review")
def final_review(attempt_id: str, payload: FinalReviewIn, user: User = Depends(require_faculty), db: Session = Depends(get_db)):
    from app.models.models import ExamAttempt
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    if not attempt or attempt.exam.faculty_id != user.id:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if payload.status not in FinalReviewStatus.__members__:
        raise HTTPException(status_code=400, detail="Invalid status")

    record = db.query(AttemptFinalReview).filter(AttemptFinalReview.attempt_id == attempt_id).first()
    if record is None:
        record = AttemptFinalReview(attempt_id=attempt_id, faculty_id=user.id, status=FinalReviewStatus(payload.status), notes=payload.notes)
        db.add(record)
    else:
        record.status = FinalReviewStatus(payload.status)
        record.notes = payload.notes
        record.updated_at = datetime.utcnow()

    db.commit()
    log_action(db, user, "Faculty Final Integrity Decision", "ExamAttempt", attempt_id, {"status": payload.status})
    return {"detail": "saved"}
