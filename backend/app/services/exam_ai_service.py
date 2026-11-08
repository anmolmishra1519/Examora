from __future__ import annotations

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.models import Exam, ExamSection, Question, QuestionOption
from app.services.document_parser import extract_text
from app.services.question_extractor import extract_exam_structure

settings = get_settings()

PROCESSING_STEPS = [
    "Document uploaded",
    "Text extracted",
    "Sections detected",
    "Questions identified",
    "Question types detected",
    "Marks identified",
    "Options detected",
    "Instructions detected",
    "Examination structure generated",
]


def process_uploaded_document(db: Session, exam: Exam, file_bytes: bytes, filename: str, content_type: str) -> Exam:
    exam.processing_status = "processing"
    exam.processing_log = [PROCESSING_STEPS[0]]
    db.commit()

    try:
        extraction = extract_text(file_bytes, filename, content_type)
        exam.processing_log = exam.processing_log + [PROCESSING_STEPS[1]]

        if settings.AI_PROVIDER == "llm" and settings.AI_API_KEY:
            from app.ai.llm_provider import extract_with_llm
            outcome = extract_with_llm(extraction.text, settings.AI_API_KEY)
        else:
            outcome = extract_exam_structure(extraction.text)

        exam.processing_log = exam.processing_log + PROCESSING_STEPS[2:]

        # Clear anything from a previous parse attempt.
        exam.sections.clear()
        db.flush()

        for s_order, section in enumerate(outcome.sections):
            db_section = ExamSection(
                exam_id=exam.id, name=section.name.strip() or f"Section {s_order + 1}",
                instructions=section.instructions.strip(), order=s_order,
            )
            db.add(db_section)
            db.flush()

            for q_order, question in enumerate(section.questions):
                db_question = Question(
                    exam_id=exam.id,
                    section_id=db_section.id,
                    question_text=question.text,
                    question_type=question.question_type,
                    marks=question.marks,
                    order=q_order,
                    correct_answer=question.correct_answer,
                    ai_generated_answer=question.ai_generated_answer,
                    ai_confidence=question.confidence,
                    needs_review=question.needs_review,
                )
                db.add(db_question)
                db.flush()

                for opt in question.options:
                    db.add(QuestionOption(
                        question_id=db_question.id, label=opt.label, text=opt.text, order=opt.order,
                    ))

        exam.total_marks = int(outcome.total_marks)
        exam.source_document_name = filename
        exam.source_document_type = content_type
        exam.extraction_confidence = {
            "questions_detected": outcome.total_questions,
            "needs_review": outcome.needs_review_count,
            "warnings": outcome.warnings,
            "used_ocr": extraction.used_ocr,
        }
        exam.processing_status = "needs_review" if outcome.needs_review_count or not outcome.sections else "ready"
        db.commit()
        db.refresh(exam)
        return exam

    except Exception as exc:  # pragma: no cover - defensive: never leave a broken screen
        db.rollback()
        exam.processing_status = "failed"
        exam.processing_log = [*PROCESSING_STEPS[:1], f"Processing failed: {exc}"]
        db.commit()
        db.refresh(exam)
        raise
