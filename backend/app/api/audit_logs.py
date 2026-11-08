from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.deps import require_faculty
from app.database import get_db
from app.models.models import AuditLog, User

router = APIRouter(prefix="/audit-logs", tags=["audit"])


@router.get("")
def list_audit_logs(limit: int = 100, user: User = Depends(require_faculty), db: Session = Depends(get_db)):
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()
    return [
        {
            "id": l.id, "actor": l.actor_name, "action": l.action, "entity": l.entity,
            "entity_id": l.entity_id, "timestamp": l.timestamp, "metadata": l.meta,
        }
        for l in logs
    ]
