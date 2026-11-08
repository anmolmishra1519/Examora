from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.auth.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.models.models import RoleEnum, User
from app.schemas.schemas import LoginRequest, RegisterRequest, TokenResponse, UserOut
from app.services.audit import log_action

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=RoleEnum(payload.role),
        department=payload.department,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_action(db, user, "User Registered", "User", user.id)

    token = create_access_token(user.id, user.role.value)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been deactivated")

    token = create_access_token(user.id, user.role.value)
    log_action(db, user, "User Logged In", "User", user.id)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/logout")
def logout(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    log_action(db, user, "User Logged Out", "User", user.id)
    return {"detail": "Logged out"}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return UserOut.model_validate(user)
