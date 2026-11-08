from __future__ import annotations

import random
import re
import string
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user, require_faculty
from app.database import SessionLocal, get_db
from app.models.models import (
    Enrollment, Exam, ExamSection, ExamStatus, Question, QuestionOption, User,
)
from app.schemas.schemas import (
    BulkQuestionsUpdate, ExamConfigUpdate, ExamCreate, ExamListItem, ExamOut, OptionOut,
    QuestionIn, QuestionOut, SectionOut,
)
from app.services.audit import log_action
from app.services.exam_ai_service import process_uploaded_document
from app.services.storage import UploadValidationError, save_upload, validate_upload

router = APIRouter(prefix="/exams", tags=["exams"])
# Separate top-level router for single-question mutations (/questions/{id})
# so it never collides with the /exams/{exam_id} path pattern.
questions_router = APIRouter(prefix="/questions", tags=["exams"])


# ------------------------------------------------------------ serializers --

def _question_out(q: Question) -> QuestionOut:
    return QuestionOut(
        id=q.id, section_id=q.section_id, question_text=q.question_text,
        question_type=q.question_type.value, marks=q.marks, negative_marks=q.negative_marks,
        difficulty=q.difficulty, order=q.order, explanation=q.explanation,
        correct_answer=q.correct_answer, ai_generated_answer=q.ai_generated_answer,
        needs_review=q.needs_review, ai_confidence=q.ai_confidence or {},
        options=[OptionOut(id=o.id, label=o.label, text=o.text, order=o.order) for o in q.options],
    )


def _section_out(s: ExamSection) -> SectionOut:
    return SectionOut(
        id=s.id, name=s.name, instructions=s.instructions, order=s.order,
        questions=[_question_out(q) for q in s.questions],
    )


def _exam_out(exam: Exam) -> ExamOut:
    question_count = sum(len(s.questions) for s in exam.sections)
    return ExamOut(
        id=exam.id, title=exam.title, subject=exam.subject, course_id=exam.course_id,
        semester=exam.semester, exam_date=exam.exam_date, duration_minutes=exam.duration_minutes,
        total_marks=exam.total_marks, passing_marks=exam.passing_marks,
        negative_marking=exam.negative_marking, randomize_questions=exam.randomize_questions,
        randomize_options=exam.randomize_options, allow_mark_for_review=exam.allow_mark_for_review,
        free_navigation=exam.free_navigation, proctoring_enabled=exam.proctoring_enabled,
        proctor_sensitivity=exam.proctor_sensitivity, warning_limit=exam.warning_limit,
        result_release_mode=exam.result_release_mode, reveal_answers=exam.reveal_answers,
        status=exam.status.value, access_code=exam.access_code,
        source_document_name=exam.source_document_name, processing_status=exam.processing_status,
        processing_log=exam.processing_log or [], extraction_confidence=exam.extraction_confidence or {},
        created_at=exam.created_at, published_at=exam.published_at,
        sections=[_section_out(s) for s in exam.sections], question_count=question_count,
    )


def _list_item(exam: Exam) -> ExamListItem:
    question_count = sum(len(s.questions) for s in exam.sections)
    student_count = len({a.student_id for a in exam.attempts})
    return ExamListItem(
        id=exam.id, title=exam.title, subject=exam.subject, status=exam.status.value,
        exam_date=exam.exam_date, duration_minutes=exam.duration_minutes, total_marks=exam.total_marks,
        student_count=student_count, question_count=question_count,
    )


def _get_owned_exam(db: Session, exam_id: str, user: User) -> Exam:
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found")
    if user.role.value == "faculty" and exam.faculty_id != user.id:
        raise HTTPException(status_code=403, detail="You do not have access to this examination")
    return exam


def _generate_access_code(subject: str) -> str:
    letters = "".join(ch for ch in subject.upper() if ch.isalpha())[:4] or "EXAM"
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"{letters}-{suffix}"


# ------------------------------------------------------------------ CRUD --

@router.post("", response_model=ExamOut)
def create_exam(payload: ExamCreate, user: User = Depends(require_faculty), db: Session = Depends(get_db)):
    exam = Exam(
        title=payload.title, subject=payload.subject, course_id=payload.course_id,
        semester=payload.semester, faculty_id=user.id, status=ExamStatus.draft,
    )
    db.add(exam)
    db.commit()
    db.refresh(exam)
    log_action(db, user, "Exam Created", "Exam", exam.id, {"title": exam.title})
    return _exam_out(exam)


@router.get("", response_model=list[ExamListItem])
def list_exams(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role.value == "faculty":
        exams = db.query(Exam).filter(Exam.faculty_id == user.id).order_by(Exam.created_at.desc()).all()
    else:
        enrolled_course_ids = {e.course_id for e in db.query(Enrollment).filter(Enrollment.student_id == user.id)}
        exams = (
            db.query(Exam)
            .filter(Exam.status != ExamStatus.draft)
            .order_by(Exam.exam_date.asc().nullslast())
            .all()
        )
        exams = [e for e in exams if e.course_id is None or e.course_id in enrolled_course_ids]
    return [_list_item(e) for e in exams]


@router.get("/{exam_id}", response_model=ExamOut)
def get_exam(exam_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found")
    if user.role.value == "student" and exam.status == ExamStatus.draft:
        raise HTTPException(status_code=404, detail="Examination not found")

    out = _exam_out(exam)
    if user.role.value == "student":
        out = _sanitize_for_student(out)
    return out


def _sanitize_for_student(exam_out: ExamOut) -> ExamOut:
    """Never let answer keys or AI-review metadata reach a student, whether
    the exam is upcoming or in progress - only the faculty view exposes
    correct_answer / ai_confidence / needs_review."""
    for section in exam_out.sections:
        for q in section.questions:
            q.correct_answer = None
            q.ai_generated_answer = False
            q.needs_review = False
            q.ai_confidence = {}
    return exam_out


@router.put("/{exam_id}", response_model=ExamOut)
def update_exam(exam_id: str, payload: ExamConfigUpdate, user: User = Depends(require_faculty), db: Session = Depends(get_db)):
    exam = _get_owned_exam(db, exam_id, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(exam, field, value)
    exam.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(exam)
    log_action(db, user, "Exam Configuration Updated", "Exam", exam.id)
    return _exam_out(exam)


@router.delete("/{exam_id}")
def delete_exam(exam_id: str, user: User = Depends(require_faculty), db: Session = Depends(get_db)):
    exam = _get_owned_exam(db, exam_id, user)
    if exam.status in (ExamStatus.live, ExamStatus.completed):
        raise HTTPException(status_code=400, detail="Live or completed examinations cannot be deleted, only archived")
    db.delete(exam)
    db.commit()
    log_action(db, user, "Exam Deleted", "Exam", exam_id)
    return {"detail": "Examination deleted"}


@router.post("/{exam_id}/publish", response_model=ExamOut)
def publish_exam(exam_id: str, user: User = Depends(require_faculty), db: Session = Depends(get_db)):
    exam = _get_owned_exam(db, exam_id, user)
    question_count = sum(len(s.questions) for s in exam.sections)
    if question_count == 0:
        raise HTTPException(status_code=400, detail="Add at least one question before publishing")

    exam.status = ExamStatus.scheduled if exam.exam_date and exam.exam_date > datetime.utcnow() else ExamStatus.live
    exam.access_code = exam.access_code or _generate_access_code(exam.subject)
    exam.published_at = datetime.utcnow()
    db.commit()
    db.refresh(exam)
    log_action(db, user, "Exam Published", "Exam", exam.id, {"access_code": exam.access_code})
    return _exam_out(exam)


@router.post("/{exam_id}/archive", response_model=ExamOut)
def archive_exam(exam_id: str, user: User = Depends(require_faculty), db: Session = Depends(get_db)):
    exam = _get_owned_exam(db, exam_id, user)
    exam.status = ExamStatus.archived
    db.commit()
    db.refresh(exam)
    log_action(db, user, "Exam Archived", "Exam", exam.id)
    return _exam_out(exam)


# ---------------------------------------------------------- doc processing --

def _run_processing_job(exam_id: str, file_bytes: bytes, filename: str, content_type: str):
    db = SessionLocal()
    try:
        exam = db.query(Exam).filter(Exam.id == exam_id).first()
        if exam:
            process_uploaded_document(db, exam, file_bytes, filename, content_type)
    finally:
        db.close()


@router.post("/upload", response_model=ExamOut)
async def upload_question_paper(
    background_tasks: BackgroundTasks,
    title: str,
    subject: str,
    file: UploadFile = File(...),
    course_id: str | None = None,
    semester: str | None = None,
    user: User = Depends(require_faculty),
    db: Session = Depends(get_db),
):
    file_bytes = await file.read()
    try:
        validate_upload(file.filename, file.content_type, len(file_bytes))
    except UploadValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    exam = Exam(
        title=title, subject=subject, course_id=course_id, semester=semester,
        faculty_id=user.id, status=ExamStatus.draft, processing_status="uploading",
    )
    db.add(exam)
    db.commit()
    db.refresh(exam)

    save_upload(exam.id, file_bytes, file.filename)
    log_action(db, user, "Question Paper Uploaded", "Exam", exam.id, {"filename": file.filename})

    background_tasks.add_task(_run_processing_job, exam.id, file_bytes, file.filename, file.content_type or "")
    return _exam_out(exam)


@router.post("/{exam_id}/parse", response_model=ExamOut)
def reparse_exam(exam_id: str, background_tasks: BackgroundTasks, user: User = Depends(require_faculty), db: Session = Depends(get_db)):
    """Retry processing using the previously uploaded document."""
    exam = _get_owned_exam(db, exam_id, user)
    if not exam.source_document_name:
        raise HTTPException(status_code=400, detail="No source document to reprocess")

    import os
    from app.config import get_settings
    from app.services.storage import load_file
    settings = get_settings()
    ext = exam.source_document_name.lower().rsplit(".", 1)[-1]
    path = os.path.join(settings.STORAGE_PATH, f"{exam.id}.{ext}")
    if not os.path.exists(path):
        raise HTTPException(status_code=400, detail="Original document could not be located for reprocessing")

    file_bytes = load_file(path)
    exam.processing_status = "processing"
    db.commit()
    background_tasks.add_task(_run_processing_job, exam.id, file_bytes, exam.source_document_name, exam.source_document_type or "")
    log_action(db, user, "AI Processing Restarted", "Exam", exam.id)
    return _exam_out(exam)


@router.get("/{exam_id}/processing-status")
def processing_status(exam_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found")
    question_count = sum(len(s.questions) for s in exam.sections)
    section_count = len(exam.sections)
    return {
        "processing_status": exam.processing_status,
        "processing_log": exam.processing_log or [],
        "extraction_confidence": exam.extraction_confidence or {},
        "question_count": question_count,
        "section_count": section_count,
        "total_marks": exam.total_marks,
        "duration_minutes": exam.duration_minutes,
    }


# -------------------------------------------------------------- questions --

@router.put("/{exam_id}/questions", response_model=ExamOut)
def replace_questions(exam_id: str, payload: BulkQuestionsUpdate, user: User = Depends(require_faculty), db: Session = Depends(get_db)):
    """Full replace of an exam's sections/questions/options - used by the
    AI Review screen and the Question Editor (add/edit/delete/reorder all
    happen client-side then get saved as one consistent structure)."""
    exam = _get_owned_exam(db, exam_id, user)

    exam.sections.clear()
    db.flush()

    total_marks = 0.0
    for s_order, section in enumerate(payload.sections):
        db_section = ExamSection(exam_id=exam.id, name=section.name, instructions=section.instructions, order=s_order)
        db.add(db_section)
        db.flush()

        for q_order, q in enumerate(section.questions):
            db_question = Question(
                exam_id=exam.id, section_id=db_section.id, question_text=q.question_text,
                question_type=q.question_type, marks=q.marks, negative_marks=q.negative_marks,
                difficulty=q.difficulty, order=q_order, explanation=q.explanation,
                correct_answer=q.correct_answer, ai_generated_answer=q.ai_generated_answer,
                needs_review=q.needs_review, ai_confidence=q.ai_confidence,
            )
            db.add(db_question)
            db.flush()
            total_marks += q.marks

            for o_order, opt in enumerate(q.options):
                db.add(QuestionOption(question_id=db_question.id, label=opt.label, text=opt.text, order=o_order))

    exam.total_marks = int(total_marks)
    exam.processing_status = "ready"
    db.commit()
    db.refresh(exam)
    log_action(db, user, "Questions Edited", "Exam", exam.id)
    return _exam_out(exam)


@questions_router.put("/{question_id}", response_model=QuestionOut)
def update_question(question_id: str, payload: QuestionIn, user: User = Depends(require_faculty), db: Session = Depends(get_db)):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    exam = db.query(Exam).filter(Exam.id == question.exam_id).first()
    if exam.faculty_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    question.question_text = payload.question_text
    question.question_type = payload.question_type
    question.marks = payload.marks
    question.negative_marks = payload.negative_marks
    question.difficulty = payload.difficulty
    question.explanation = payload.explanation
    question.correct_answer = payload.correct_answer
    question.needs_review = payload.needs_review
    if payload.section_id:
        question.section_id = payload.section_id

    question.options.clear()
    db.flush()
    for i, opt in enumerate(payload.options):
        db.add(QuestionOption(question_id=question.id, label=opt.label, text=opt.text, order=i))

    exam.total_marks = int(sum(q.marks for s in exam.sections for q in s.questions))
    db.commit()
    db.refresh(question)
    log_action(db, user, "Question Edited", "Question", question.id)
    return _question_out(question)


@questions_router.delete("/{question_id}")
def delete_question(question_id: str, user: User = Depends(require_faculty), db: Session = Depends(get_db)):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    exam = db.query(Exam).filter(Exam.id == question.exam_id).first()
    if exam.faculty_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    db.delete(question)
    db.flush()
    exam.total_marks = int(sum(q.marks for s in exam.sections for q in s.questions))
    db.commit()
    log_action(db, user, "Question Deleted", "Question", question_id)
    return {"detail": "Question deleted"}
