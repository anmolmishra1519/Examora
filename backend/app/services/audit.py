from sqlalchemy.orm import Session

from app.models.models import AuditLog, User


def log_action(db: Session, actor: User | None, action: str, entity: str, entity_id: str | None = None, meta: dict | None = None):
    entry = AuditLog(
        actor_id=actor.id if actor else None,
        actor_name=actor.full_name if actor else "System",
        action=action,
        entity=entity,
        entity_id=entity_id,
        meta=meta or {},
    )
    db.add(entry)
    db.commit()
