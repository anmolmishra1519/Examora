from datetime import datetime
from typing import Any, Optional, Union

from pydantic import BaseModel, EmailStr, Field


# ------------------------------------------------------------------ auth --

class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str = Field(min_length=6)
    role: str = Field(pattern="^(faculty|student)$")
    department: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    id: str
    full_name: str
    email: str
    role: str
    department: Optional[str] = None

    class Config:
        from_attributes = True


# --------------------------------------------------------------- courses --

class CourseCreate(BaseModel):
    name: str
    code: str
    semester: Optional[str] = None


class CourseOut(BaseModel):
    id: str
    name: str
    code: str
    semester: Optional[str] = None
    student_count: int = 0

    class Config:
        from_attributes = True


# -------------------------------------------------------------- options --

class OptionIn(BaseModel):
    id: Optional[str] = None
    label: str
    text: str
    order: int = 0


class OptionOut(OptionIn):
    class Config:
        from_attributes = True


# ------------------------------------------------------------- questions --

class QuestionIn(BaseModel):
    id: Optional[str] = None
    section_id: Optional[str] = None
    question_text: str
    question_type: str
    marks: float = 1
    negative_marks: float = 0
    difficulty: str = "medium"
    order: int = 0
    explanation: Optional[str] = None
    correct_answer: Optional[Any] = None
    ai_generated_answer: bool = False
    needs_review: bool = False
    ai_confidence: dict = {}
    options: list[OptionIn] = []


class QuestionOut(BaseModel):
    id: str
    section_id: str
    question_text: str
    question_type: str
    marks: float
    negative_marks: float
    difficulty: str
    order: int
    explanation: Optional[str] = None
    correct_answer: Optional[Any] = None
    ai_generated_answer: bool
    needs_review: bool
    ai_confidence: dict
    options: list[OptionOut] = []

    class Config:
        from_attributes = True


class SectionIn(BaseModel):
    id: Optional[str] = None
    name: str
    instructions: Optional[str] = None
    order: int = 0
    questions: list[QuestionIn] = []


class SectionOut(BaseModel):
    id: str
    name: str
    instructions: Optional[str] = None
    order: int
    questions: list[QuestionOut] = []

    class Config:
        from_attributes = True


# ------------------------------------------------------------------ exam --

class ExamCreate(BaseModel):
    title: str
    subject: str
    course_id: Optional[str] = None
    semester: Optional[str] = None


class ExamConfigUpdate(BaseModel):
    title: Optional[str] = None
    subject: Optional[str] = None
    course_id: Optional[str] = None
    semester: Optional[str] = None
    exam_date: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    passing_marks: Optional[int] = None
    negative_marking: Optional[bool] = None
    randomize_questions: Optional[bool] = None
    randomize_options: Optional[bool] = None
    allow_mark_for_review: Optional[bool] = None
    free_navigation: Optional[bool] = None
    proctoring_enabled: Optional[bool] = None
    proctor_sensitivity: Optional[str] = None
    warning_limit: Optional[int] = None
    result_release_mode: Optional[str] = None
    reveal_answers: Optional[bool] = None


class ExamOut(BaseModel):
    id: str
    title: str
    subject: str
    course_id: Optional[str] = None
    semester: Optional[str] = None
    exam_date: Optional[datetime] = None
    duration_minutes: int
    total_marks: int
    passing_marks: int
    negative_marking: bool
    randomize_questions: bool
    randomize_options: bool
    allow_mark_for_review: bool
    free_navigation: bool
    proctoring_enabled: bool
    proctor_sensitivity: str
    warning_limit: int
    result_release_mode: str
    reveal_answers: bool
    status: str
    access_code: Optional[str] = None
    source_document_name: Optional[str] = None
    processing_status: str
    processing_log: list = []
    extraction_confidence: dict = {}
    created_at: datetime
    published_at: Optional[datetime] = None
    sections: list[SectionOut] = []
    question_count: int = 0

    class Config:
        from_attributes = True


class ExamListItem(BaseModel):
    id: str
    title: str
    subject: str
    status: str
    exam_date: Optional[datetime] = None
    duration_minutes: int
    total_marks: int
    student_count: int = 0
    question_count: int = 0

    class Config:
        from_attributes = True


class BulkQuestionsUpdate(BaseModel):
    sections: list[SectionIn]


# --------------------------------------------------------------- attempt --

class AttemptStart(BaseModel):
    exam_id: str
    consent_given: bool = True


class AttemptOut(BaseModel):
    id: str
    exam_id: str
    status: str
    server_start_time: Optional[datetime] = None
    server_end_time: Optional[datetime] = None
    seconds_remaining: int = 0

    class Config:
        from_attributes = True


class AttemptQuestionOut(BaseModel):
    id: str
    section_id: str
    section_name: str
    question_text: str
    question_type: str
    marks: float
    order: int
    options: list[OptionOut] = []
    response: Optional[Any] = None
    marked_for_review: bool = False
    is_answered: bool = False


class AttemptDetailOut(BaseModel):
    id: str
    exam_id: str
    exam_title: str
    exam_subject: str
    status: str
    server_start_time: Optional[datetime] = None
    server_end_time: Optional[datetime] = None
    seconds_remaining: int = 0
    duration_minutes: int
    total_marks: int
    proctoring_enabled: bool
    allow_mark_for_review: bool
    questions: list[AttemptQuestionOut] = []


class AnswerSave(BaseModel):
    question_id: str
    response: Optional[Any] = None
    marked_for_review: bool = False


class AnswerOut(BaseModel):
    question_id: str
    response: Optional[Any] = None
    marked_for_review: bool
    is_answered: bool

    class Config:
        from_attributes = True


class ManualGrade(BaseModel):
    marks_awarded: float
    grader_note: Optional[str] = None


# -------------------------------------------------------------- proctor --

class ProctorSessionStart(BaseModel):
    attempt_id: str


class ProctorEventIn(BaseModel):
    attempt_id: str
    session_id: str
    event_type: str
    confidence: float = 1.0
    duration_seconds: float = 0
    description: Optional[str] = None
    evidence_reference: Optional[dict] = None


class ProctorEventOut(BaseModel):
    id: str
    event_type: str
    severity: str
    confidence: float
    timestamp: datetime
    duration_seconds: float
    description: str
    review_status: str
    evidence_reference: Optional[dict] = None

    class Config:
        from_attributes = True


class RiskOut(BaseModel):
    score: int
    risk_level: str
    reasons: list[str]

    class Config:
        from_attributes = True


class EventReviewIn(BaseModel):
    decision: str  # confirmed | dismissed | under_review
    notes: Optional[str] = None


class FinalReviewIn(BaseModel):
    status: str
    notes: Optional[str] = None


# --------------------------------------------------------------- results --

class ResultOut(BaseModel):
    attempt_id: str
    student_name: str
    exam_title: str
    total_marks: float
    marks_obtained: float
    correct_count: int
    incorrect_count: int
    unanswered_count: int
    pending_manual_grading: int
    percentage: float
    passed: Optional[bool] = None
    released: bool

    class Config:
        from_attributes = True
