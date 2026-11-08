"""
Database models for Examora.

Covers: User/Student/Faculty, Course/Enrollment, Exam/ExamSection/Question/
QuestionOption, ExamAttempt/Answer, ProctorSession/ProctorEvent/
RiskAssessment/Evidence, ExamResult, FacultyReview, AuditLog.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, JSON,
    String, Text, UniqueConstraint, Index,
)
from sqlalchemy.orm import relationship

from app.database import Base


def gen_id() -> str:
    return uuid.uuid4().hex


# ---------------------------------------------------------------- enums --

class RoleEnum(str, enum.Enum):
    faculty = "faculty"
    student = "student"
    admin = "admin"


class ExamStatus(str, enum.Enum):
    draft = "draft"
    scheduled = "scheduled"
    live = "live"
    completed = "completed"
    archived = "archived"


class QuestionType(str, enum.Enum):
    mcq = "mcq"
    multi_select = "multi_select"
    true_false = "true_false"
    short_answer = "short_answer"
    long_answer = "long_answer"
    descriptive = "descriptive"


class AttemptStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    submitted = "submitted"
    auto_submitted = "auto_submitted"
    expired = "expired"


class EventType(str, enum.Enum):
    FACE_NOT_DETECTED = "FACE_NOT_DETECTED"
    MULTIPLE_FACES = "MULTIPLE_FACES"
    STUDENT_LEFT_FRAME = "STUDENT_LEFT_FRAME"
    POSSIBLE_PHONE = "POSSIBLE_PHONE"
    GAZE_OFF_SCREEN = "GAZE_OFF_SCREEN"
    TAB_SWITCH = "TAB_SWITCH"
    WINDOW_BLUR = "WINDOW_BLUR"
    FULLSCREEN_EXIT = "FULLSCREEN_EXIT"
    PAGE_VISIBILITY_CHANGE = "PAGE_VISIBILITY_CHANGE"
    AUDIO_ACTIVITY = "AUDIO_ACTIVITY"


class SeverityEnum(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class ReviewStatus(str, enum.Enum):
    detected = "detected"
    under_review = "under_review"
    confirmed = "confirmed"
    dismissed = "dismissed"


class FinalReviewStatus(str, enum.Enum):
    normal = "normal"
    reviewed_no_violation = "reviewed_no_violation"
    reviewed_violation = "reviewed_violation"
    further_investigation = "further_investigation"


# ---------------------------------------------------------------- core ---

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_id)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(Enum(RoleEnum), nullable=False)
    department = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    courses_taught = relationship("Course", back_populates="faculty")
    enrollments = relationship("Enrollment", back_populates="student")
    attempts = relationship("ExamAttempt", back_populates="student")


class Course(Base):
    __tablename__ = "courses"

    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    code = Column(String, nullable=False)
    semester = Column(String, nullable=True)
    faculty_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    faculty = relationship("User", back_populates="courses_taught")
    enrollments = relationship("Enrollment", back_populates="course")
    exams = relationship("Exam", back_populates="course")


class Enrollment(Base):
    __tablename__ = "enrollments"
    __table_args__ = (UniqueConstraint("course_id", "student_id", name="uq_enrollment"),)

    id = Column(String, primary_key=True, default=gen_id)
    course_id = Column(String, ForeignKey("courses.id"), nullable=False)
    student_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    course = relationship("Course", back_populates="enrollments")
    student = relationship("User", back_populates="enrollments")


class Exam(Base):
    __tablename__ = "exams"

    id = Column(String, primary_key=True, default=gen_id)
    title = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    course_id = Column(String, ForeignKey("courses.id"), nullable=True)
    faculty_id = Column(String, ForeignKey("users.id"), nullable=False)
    semester = Column(String, nullable=True)

    exam_date = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, default=60)
    total_marks = Column(Integer, default=0)
    passing_marks = Column(Integer, default=0)

    negative_marking = Column(Boolean, default=False)
    randomize_questions = Column(Boolean, default=False)
    randomize_options = Column(Boolean, default=False)
    allow_mark_for_review = Column(Boolean, default=True)
    free_navigation = Column(Boolean, default=True)

    proctoring_enabled = Column(Boolean, default=True)
    proctor_sensitivity = Column(String, default="medium")  # low | medium | high
    warning_limit = Column(Integer, default=3)

    result_release_mode = Column(String, default="manual")  # manual | automatic
    reveal_answers = Column(Boolean, default=False)

    status = Column(Enum(ExamStatus), default=ExamStatus.draft)
    access_code = Column(String, unique=True, nullable=True)

    source_document_name = Column(String, nullable=True)
    source_document_type = Column(String, nullable=True)
    processing_status = Column(String, default="none")  # none|uploading|processing|needs_review|ready|failed
    processing_log = Column(JSON, default=list)
    extraction_confidence = Column(JSON, default=dict)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    published_at = Column(DateTime, nullable=True)

    course = relationship("Course", back_populates="exams")
    sections = relationship("ExamSection", back_populates="exam", cascade="all, delete-orphan", order_by="ExamSection.order")
    attempts = relationship("ExamAttempt", back_populates="exam")


class ExamSection(Base):
    __tablename__ = "exam_sections"

    id = Column(String, primary_key=True, default=gen_id)
    exam_id = Column(String, ForeignKey("exams.id"), nullable=False)
    name = Column(String, nullable=False)
    instructions = Column(Text, nullable=True)
    order = Column(Integer, default=0)

    exam = relationship("Exam", back_populates="sections")
    questions = relationship("Question", back_populates="section", cascade="all, delete-orphan", order_by="Question.order")


class Question(Base):
    __tablename__ = "questions"

    id = Column(String, primary_key=True, default=gen_id)
    exam_id = Column(String, ForeignKey("exams.id"), nullable=False)
    section_id = Column(String, ForeignKey("exam_sections.id"), nullable=False)

    question_text = Column(Text, nullable=False)
    question_type = Column(Enum(QuestionType), nullable=False)
    marks = Column(Float, default=1)
    negative_marks = Column(Float, default=0)
    difficulty = Column(String, default="medium")
    order = Column(Integer, default=0)
    explanation = Column(Text, nullable=True)

    correct_answer = Column(JSON, nullable=True)  # str | list[str] depending on type
    ai_generated_answer = Column(Boolean, default=False)

    ai_confidence = Column(JSON, default=dict)  # {"question":0.98,"type":0.96,"marks":0.99,"options":0.97,"answer":0.82}
    needs_review = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    section = relationship("ExamSection", back_populates="questions")
    options = relationship("QuestionOption", back_populates="question", cascade="all, delete-orphan", order_by="QuestionOption.order")


class QuestionOption(Base):
    __tablename__ = "question_options"

    id = Column(String, primary_key=True, default=gen_id)
    question_id = Column(String, ForeignKey("questions.id"), nullable=False)
    label = Column(String, nullable=False)  # A, B, C, D
    text = Column(Text, nullable=False)
    order = Column(Integer, default=0)

    question = relationship("Question", back_populates="options")


class ExamAttempt(Base):
    __tablename__ = "exam_attempts"

    id = Column(String, primary_key=True, default=gen_id)
    exam_id = Column(String, ForeignKey("exams.id"), nullable=False)
    student_id = Column(String, ForeignKey("users.id"), nullable=False)

    status = Column(Enum(AttemptStatus), default=AttemptStatus.not_started)
    server_start_time = Column(DateTime, nullable=True)
    server_end_time = Column(DateTime, nullable=True)  # deadline = start + duration
    submitted_at = Column(DateTime, nullable=True)

    consent_given = Column(Boolean, default=False)
    question_order = Column(JSON, default=list)  # randomized order snapshot

    created_at = Column(DateTime, default=datetime.utcnow)

    exam = relationship("Exam", back_populates="attempts")
    student = relationship("User", back_populates="attempts")
    answers = relationship("Answer", back_populates="attempt", cascade="all, delete-orphan")
    proctor_sessions = relationship("ProctorSession", back_populates="attempt", cascade="all, delete-orphan")
    result = relationship("ExamResult", back_populates="attempt", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("exam_id", "student_id", name="uq_attempt_per_student"),)


class Answer(Base):
    __tablename__ = "answers"
    __table_args__ = (
        UniqueConstraint("attempt_id", "question_id", name="uq_answer_per_question"),
        Index("ix_answers_attempt", "attempt_id"),
    )

    id = Column(String, primary_key=True, default=gen_id)
    attempt_id = Column(String, ForeignKey("exam_attempts.id"), nullable=False)
    question_id = Column(String, ForeignKey("questions.id"), nullable=False)

    response = Column(JSON, nullable=True)  # str | list[str]
    marked_for_review = Column(Boolean, default=False)
    is_answered = Column(Boolean, default=False)

    is_correct = Column(Boolean, nullable=True)
    marks_awarded = Column(Float, nullable=True)
    manually_graded = Column(Boolean, default=False)
    grader_note = Column(Text, nullable=True)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    attempt = relationship("ExamAttempt", back_populates="answers")
    question = relationship("Question")


class ProctorSession(Base):
    __tablename__ = "proctor_sessions"

    id = Column(String, primary_key=True, default=gen_id)
    attempt_id = Column(String, ForeignKey("exam_attempts.id"), nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    mode = Column(String, default="live")  # live | demo

    attempt = relationship("ExamAttempt", back_populates="proctor_sessions")
    events = relationship("ProctorEvent", back_populates="session", cascade="all, delete-orphan")
    risk_assessment = relationship("RiskAssessment", back_populates="session", uselist=False, cascade="all, delete-orphan")


class ProctorEvent(Base):
    __tablename__ = "proctor_events"
    __table_args__ = (Index("ix_events_session", "session_id"),)

    id = Column(String, primary_key=True, default=gen_id)
    session_id = Column(String, ForeignKey("proctor_sessions.id"), nullable=False)
    exam_id = Column(String, ForeignKey("exams.id"), nullable=False)
    attempt_id = Column(String, ForeignKey("exam_attempts.id"), nullable=False)
    student_id = Column(String, ForeignKey("users.id"), nullable=False)

    event_type = Column(Enum(EventType), nullable=False)
    severity = Column(Enum(SeverityEnum), nullable=False)
    confidence = Column(Float, default=1.0)
    timestamp = Column(DateTime, default=datetime.utcnow)
    duration_seconds = Column(Float, default=0)
    description = Column(String, nullable=False)
    evidence_reference = Column(JSON, nullable=True)  # {"type":"snapshot","note":...} - metadata only

    review_status = Column(Enum(ReviewStatus), default=ReviewStatus.detected)

    session = relationship("ProctorSession", back_populates="events")
    review = relationship("FacultyReview", back_populates="event", uselist=False, cascade="all, delete-orphan")
    exam = relationship("Exam")
    attempt = relationship("ExamAttempt")


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id = Column(String, primary_key=True, default=gen_id)
    session_id = Column(String, ForeignKey("proctor_sessions.id"), nullable=False, unique=True)
    score = Column(Integer, default=100)  # 0-100, higher = safer
    risk_level = Column(String, default="low")  # low | medium | high
    reasons = Column(JSON, default=list)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    session = relationship("ProctorSession", back_populates="risk_assessment")


class Evidence(Base):
    """Minimal, optional evidence metadata (e.g. a single low-res snapshot
    reference at the moment of a high-severity event). Raw video/audio is
    never persisted by default - see privacy notes in README."""
    __tablename__ = "evidence"

    id = Column(String, primary_key=True, default=gen_id)
    event_id = Column(String, ForeignKey("proctor_events.id"), nullable=False)
    kind = Column(String, default="snapshot_metadata")
    data = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)


class ExamResult(Base):
    __tablename__ = "exam_results"

    id = Column(String, primary_key=True, default=gen_id)
    attempt_id = Column(String, ForeignKey("exam_attempts.id"), nullable=False, unique=True)

    total_marks = Column(Float, default=0)
    marks_obtained = Column(Float, default=0)
    correct_count = Column(Integer, default=0)
    incorrect_count = Column(Integer, default=0)
    unanswered_count = Column(Integer, default=0)
    pending_manual_grading = Column(Integer, default=0)
    percentage = Column(Float, default=0)
    passed = Column(Boolean, nullable=True)

    released = Column(Boolean, default=False)
    released_at = Column(DateTime, nullable=True)
    computed_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    attempt = relationship("ExamAttempt", back_populates="result")


class FacultyReview(Base):
    __tablename__ = "faculty_reviews"

    id = Column(String, primary_key=True, default=gen_id)
    event_id = Column(String, ForeignKey("proctor_events.id"), nullable=False, unique=True)
    faculty_id = Column(String, ForeignKey("users.id"), nullable=False)
    decision = Column(Enum(ReviewStatus), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    event = relationship("ProctorEvent", back_populates="review")


class AttemptFinalReview(Base):
    """Overall faculty verdict for a student's attempt, aggregated from
    individual event reviews."""
    __tablename__ = "attempt_final_reviews"

    id = Column(String, primary_key=True, default=gen_id)
    attempt_id = Column(String, ForeignKey("exam_attempts.id"), nullable=False, unique=True)
    faculty_id = Column(String, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(FinalReviewStatus), default=FinalReviewStatus.normal)
    notes = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=gen_id)
    actor_id = Column(String, ForeignKey("users.id"), nullable=True)
    actor_name = Column(String, nullable=True)
    action = Column(String, nullable=False)
    entity = Column(String, nullable=False)
    entity_id = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    meta = Column(JSON, default=dict)
