"""
Risk engine.

Every proctor event carries a weight; the risk score starts at 100 (a
perfectly clean session) and is reduced by weighted, confidence- and
duration-adjusted deductions. The score is explicitly an *indicator*,
never framed as proof of misconduct - see EVENT_LABELS and the faculty
review flow which always requires a human decision.

A short cooldown per event type prevents one continuous incident (e.g.
a student stepping away for 30s) from being chopped into dozens of
near-duplicate events and over-penalizing the score.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.models import ProctorEvent, ProctorSession, RiskAssessment, SeverityEnum

# Base point deduction per event type (out of a 100-point score).
EVENT_WEIGHTS: dict[str, int] = {
    "TAB_SWITCH": 5,
    "WINDOW_BLUR": 3,
    "FULLSCREEN_EXIT": 5,
    "PAGE_VISIBILITY_CHANGE": 2,
    "FACE_NOT_DETECTED": 8,
    "STUDENT_LEFT_FRAME": 8,
    "MULTIPLE_FACES": 25,
    "POSSIBLE_PHONE": 25,
    "GAZE_OFF_SCREEN": 6,
    "AUDIO_ACTIVITY": 6,
}

EVENT_SEVERITY: dict[str, SeverityEnum] = {
    "TAB_SWITCH": SeverityEnum.low,
    "WINDOW_BLUR": SeverityEnum.low,
    "FULLSCREEN_EXIT": SeverityEnum.medium,
    "PAGE_VISIBILITY_CHANGE": SeverityEnum.low,
    "FACE_NOT_DETECTED": SeverityEnum.medium,
    "STUDENT_LEFT_FRAME": SeverityEnum.medium,
    "MULTIPLE_FACES": SeverityEnum.high,
    "POSSIBLE_PHONE": SeverityEnum.high,
    "GAZE_OFF_SCREEN": SeverityEnum.low,
    "AUDIO_ACTIVITY": SeverityEnum.medium,
}

EVENT_LABELS: dict[str, str] = {
    "TAB_SWITCH": "Tab switch detected",
    "WINDOW_BLUR": "Exam window lost focus",
    "FULLSCREEN_EXIT": "Exited fullscreen mode",
    "PAGE_VISIBILITY_CHANGE": "Page visibility changed",
    "FACE_NOT_DETECTED": "Face not detected",
    "STUDENT_LEFT_FRAME": "Student not visible in camera frame",
    "MULTIPLE_FACES": "Multiple faces detected",
    "POSSIBLE_PHONE": "Possible mobile phone detected",
    "GAZE_OFF_SCREEN": "Repeated off-screen head orientation detected",
    "AUDIO_ACTIVITY": "Sustained speech activity detected",
}

# Repeated events of the same type within this window are treated as one
# ongoing incident rather than N separate incidents when scoring.
COOLDOWN_SECONDS: dict[str, int] = {
    "TAB_SWITCH": 3,
    "WINDOW_BLUR": 3,
    "FULLSCREEN_EXIT": 3,
    "PAGE_VISIBILITY_CHANGE": 3,
    "FACE_NOT_DETECTED": 10,
    "STUDENT_LEFT_FRAME": 10,
    "MULTIPLE_FACES": 8,
    "POSSIBLE_PHONE": 8,
    "GAZE_OFF_SCREEN": 12,
    "AUDIO_ACTIVITY": 8,
}

REPEATED_ACTIVITY_THRESHOLD = 5  # total events before an extra "repeated activity" penalty applies
REPEATED_ACTIVITY_PENALTY = 10


def is_duplicate_within_cooldown(db: Session, session_id: str, event_type: str, now: datetime) -> bool:
    cooldown = COOLDOWN_SECONDS.get(event_type, 5)
    window_start = now - timedelta(seconds=cooldown)
    recent = (
        db.query(ProctorEvent)
        .filter(
            ProctorEvent.session_id == session_id,
            ProctorEvent.event_type == event_type,
            ProctorEvent.timestamp >= window_start,
        )
        .first()
    )
    return recent is not None


def severity_for(event_type: str) -> SeverityEnum:
    return EVENT_SEVERITY.get(event_type, SeverityEnum.low)


def label_for(event_type: str) -> str:
    return EVENT_LABELS.get(event_type, event_type.replace("_", " ").title())


def recompute_risk(db: Session, session: ProctorSession) -> RiskAssessment:
    events = db.query(ProctorEvent).filter(ProctorEvent.session_id == session.id).all()

    score = 100.0
    reasons: list[str] = []
    counts: dict[str, int] = {}

    for event in events:
        weight = EVENT_WEIGHTS.get(event.event_type.value, 5)
        duration_multiplier = 1.0 + min(event.duration_seconds / 30.0, 1.0)  # up to 2x for long incidents
        deduction = weight * event.confidence * duration_multiplier
        score -= deduction
        counts[event.event_type.value] = counts.get(event.event_type.value, 0) + 1

    if len(events) >= REPEATED_ACTIVITY_THRESHOLD:
        score -= REPEATED_ACTIVITY_PENALTY
        reasons.append(f"{len(events)} total suspicious events (repeated activity penalty applied)")

    for event_type, count in sorted(counts.items(), key=lambda kv: -kv[1]):
        label = label_for(event_type)
        plural = "s" if count != 1 else ""
        reasons.append(f"{count} {label.lower()}{plural}")

    score = max(0, min(100, round(score)))
    if score >= 75:
        level = "low"
    elif score >= 45:
        level = "medium"
    else:
        level = "high"

    assessment = session.risk_assessment
    if assessment is None:
        assessment = RiskAssessment(session_id=session.id)
        db.add(assessment)

    assessment.score = score
    assessment.risk_level = level
    assessment.reasons = reasons or ["No suspicious activity detected"]
    db.commit()
    db.refresh(assessment)
    return assessment
