"""
Seeds realistic demo data so Examora can be explored immediately:

    Faculty  faculty@examora.app / Demo@123
    Student  student@examora.app / Demo@123

Run with:  python -m app.seed
Safe to re-run - it skips creation if the demo faculty account already exists.
"""
from datetime import datetime, timedelta

from app.auth.security import hash_password
from app.database import Base, SessionLocal, engine
from app.models.models import (
    Answer, AttemptStatus, Course, Enrollment, EventType, Exam, ExamAttempt, ExamResult,
    ExamSection, ExamStatus, ProctorEvent, ProctorSession, Question,
    QuestionOption, QuestionType, ReviewStatus, RoleEnum, SeverityEnum, User,
)
from app.services.exam_ai_service import PROCESSING_STEPS
from app.services.grading import grade_attempt
from app.services.risk_engine import label_for, recompute_risk, severity_for

DEMO_PASSWORD = "Demo@123"

MCQ_BANK = [
    ("Which data structure does a relational database index most commonly use?", ["Stack", "B-Tree", "Linked List", "Hash Map only"], "B"),
    ("Which normal form eliminates transitive dependency?", ["1NF", "2NF", "3NF", "BCNF only"], "C"),
    ("Which SQL clause is used to filter groups after aggregation?", ["WHERE", "HAVING", "GROUP BY", "ORDER BY"], "B"),
    ("Which of these is NOT one of the ACID properties?", ["Atomicity", "Consistency", "Isolation", "Scalability"], "D"),
    ("A foreign key enforces which kind of constraint?", ["Domain integrity", "Referential integrity", "Entity integrity", "Null integrity"], "B"),
    ("Which join returns all rows from both tables, matched where possible?", ["INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "FULL OUTER JOIN"], "D"),
    ("Which isolation level allows the phenomenon known as a dirty read?", ["Serializable", "Repeatable Read", "Read Committed", "Read Uncommitted"], "D"),
    ("What does DDL stand for?", ["Data Definition Language", "Data Display Language", "Database Design Layer", "Data Duplication Logic"], "A"),
    ("Which key uniquely identifies a row and cannot be NULL?", ["Foreign key", "Candidate key", "Primary key", "Composite key"], "C"),
    ("Which of the following is a multi-valued dependency scenario handled by 4NF?", ["Partial dependency", "Transitive dependency", "Independent multi-valued attributes", "Functional dependency"], "C"),
    ("What is the primary purpose of database normalization?", ["Increase redundancy", "Reduce redundancy and anomalies", "Improve UI design", "Increase storage cost"], "B"),
    ("Which command permanently removes a table and its structure?", ["DELETE", "TRUNCATE", "DROP", "REMOVE"], "C"),
    ("A deadlock in a DBMS occurs when...", ["A query runs slowly", "Two transactions wait on each other's locks indefinitely", "A table has no primary key", "An index is missing"], "B"),
    ("Which of these best describes a view in SQL?", ["A physical copy of a table", "A virtual table based on a query", "An index structure", "A stored procedure"], "B"),
    ("Which concurrency control technique uses timestamps to order transactions?", ["Two-phase locking", "Timestamp ordering", "Shadow paging", "Write-ahead logging"], "B"),
]

SHORT_ANSWER_BANK = [
    "Explain the concept of database normalization and why it matters.",
    "What is the difference between a primary key and a unique key?",
    "Describe the purpose of an index in a relational database.",
    "What is a transaction in DBMS? Give one real-world example.",
    "Differentiate between DELETE and TRUNCATE commands.",
    "What is referential integrity and how is it enforced?",
    "Explain the difference between a clustered and non-clustered index.",
    "What is denormalization and when would you use it?",
    "Describe the purpose of a foreign key constraint with an example.",
    "What is the difference between a shared lock and an exclusive lock?",
]

LONG_ANSWER_BANK = [
    "Explain the ACID properties of a database transaction with an example for each.",
    "Describe the three-level (ANSI-SPARC) database architecture and the purpose of each level.",
    "Explain the process of normalization from 1NF through BCNF with a worked example.",
    "Discuss deadlock detection and prevention strategies in a multi-user DBMS.",
    "Compare and contrast optimistic and pessimistic concurrency control mechanisms.",
]


def _mk_options(question: Question, choices: list[str]):
    for i, text in enumerate(choices):
        label = chr(65 + i)
        question.options.append(QuestionOption(question_id=question.id, label=label, text=text, order=i))


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == "faculty@examora.app").first():
            print("Demo data already present - skipping seed.")
            return

        faculty = User(full_name="Dr. Ananya Rao", email="faculty@examora.app",
                        hashed_password=hash_password(DEMO_PASSWORD), role=RoleEnum.faculty, department="Computer Science")
        db.add(faculty)
        db.flush()

        students_info = [
            ("student@examora.app", "Rahul Sharma"),
            ("priya.iyer@examora.app", "Priya Iyer"),
            ("aman.verma@examora.app", "Aman Verma"),
            ("sara.khan@examora.app", "Sara Khan"),
        ]
        students = []
        for email, name in students_info:
            s = User(full_name=name, email=email, hashed_password=hash_password(DEMO_PASSWORD), role=RoleEnum.student)
            db.add(s)
            students.append(s)
        db.flush()

        course = Course(name="Database Management Systems", code="CS301", semester="Semester 5", faculty_id=faculty.id)
        db.add(course)
        db.flush()
        for s in students:
            db.add(Enrollment(course_id=course.id, student_id=s.id))
        db.flush()

        # ---------------------------------------------------- main demo exam --
        exam = Exam(
            title="Mid Semester Examination", subject="Database Management Systems",
            course_id=course.id, faculty_id=faculty.id, semester="Semester 5",
            exam_date=datetime.utcnow() + timedelta(days=1), duration_minutes=90,
            passing_marks=24, negative_marking=False, randomize_questions=False,
            randomize_options=False, proctoring_enabled=True, proctor_sensitivity="medium",
            warning_limit=3, result_release_mode="manual", status=ExamStatus.live,
            access_code="DBMS-28A7", source_document_name="DBMS_MidSem_QuestionPaper.pdf",
            source_document_type="application/pdf", processing_status="ready",
            processing_log=PROCESSING_STEPS,
            extraction_confidence={"questions_detected": 30, "needs_review": 0, "warnings": [], "used_ocr": False},
        )
        db.add(exam)
        db.flush()

        section_a = ExamSection(exam_id=exam.id, name="Section A - Multiple Choice Questions",
                                 instructions="15 × 1 = 15 marks. Choose the single best answer.", order=0)
        section_b = ExamSection(exam_id=exam.id, name="Section B - Short Answer Questions",
                                 instructions="10 × 2 = 20 marks. Answer in 3-4 sentences.", order=1)
        section_c = ExamSection(exam_id=exam.id, name="Section C - Long Answer Questions",
                                 instructions="5 × 5 = 25 marks. Answer in detail with examples.", order=2)
        db.add_all([section_a, section_b, section_c])
        db.flush()

        for i, (text, choices, answer) in enumerate(MCQ_BANK):
            q = Question(exam_id=exam.id, section_id=section_a.id, question_text=text, question_type=QuestionType.mcq,
                         marks=1, order=i, correct_answer=[answer], ai_generated_answer=True, needs_review=False,
                         ai_confidence={"question": 0.98, "type": 0.95, "marks": 0.95, "options": 0.97, "answer": 0.9})
            db.add(q)
            db.flush()
            _mk_options(q, choices)

        for i, text in enumerate(SHORT_ANSWER_BANK):
            q = Question(exam_id=exam.id, section_id=section_b.id, question_text=text, question_type=QuestionType.short_answer,
                         marks=2, order=i, correct_answer=None, needs_review=False,
                         ai_confidence={"question": 0.96, "type": 0.9, "marks": 0.9, "options": 1.0, "answer": 1.0})
            db.add(q)

        for i, text in enumerate(LONG_ANSWER_BANK):
            q = Question(exam_id=exam.id, section_id=section_c.id, question_text=text, question_type=QuestionType.long_answer,
                         marks=5, order=i, correct_answer=None, needs_review=False,
                         ai_confidence={"question": 0.95, "type": 0.9, "marks": 0.9, "options": 1.0, "answer": 1.0})
            db.add(q)

        exam.total_marks = 15 * 1 + 10 * 2 + 5 * 5  # 60
        db.commit()
        db.refresh(exam)

        # A second exam still in the builder (nothing published yet) so the
        # "Create Examination" / draft flow has something to click into.
        draft_exam = Exam(
            title="Unit Test 1", subject="Data Structures & Algorithms", course_id=course.id,
            faculty_id=faculty.id, semester="Semester 5", duration_minutes=45,
            status=ExamStatus.draft, processing_status="none",
        )
        db.add(draft_exam)

        # A completed exam with released results + integrity history, for the
        # Reports / Results pages.
        completed_exam = Exam(
            title="Quiz 1", subject="Database Management Systems", course_id=course.id,
            faculty_id=faculty.id, semester="Semester 5", exam_date=datetime.utcnow() - timedelta(days=5),
            duration_minutes=30, passing_marks=6, status=ExamStatus.completed,
            access_code="DBMS-91QZ", total_marks=10, processing_status="ready",
        )
        db.add(completed_exam)
        db.flush()
        quiz_section = ExamSection(exam_id=completed_exam.id, name="Section A - MCQ", order=0)
        db.add(quiz_section)
        db.flush()
        for i, (text, choices, answer) in enumerate(MCQ_BANK[:10]):
            q = Question(exam_id=completed_exam.id, section_id=quiz_section.id, question_text=text,
                         question_type=QuestionType.mcq, marks=1, order=i, correct_answer=[answer])
            db.add(q)
            db.flush()
            _mk_options(q, choices)
        db.commit()

        # ---------------------------------------------- sample proctor events --
        # Matches the three illustrative demo profiles from the product brief.
        profiles = [
            {"student": students[1], "events": [("TAB_SWITCH", 0.95, 0), ("TAB_SWITCH", 0.95, 0), ("TAB_SWITCH", 0.95, 0)]},
            {"student": students[2], "events": [("FACE_NOT_DETECTED", 0.9, 9)]},
            {"student": students[3], "events": [("MULTIPLE_FACES", 0.88, 6), ("POSSIBLE_PHONE", 0.87, 0)]},
        ]

        for profile in profiles:
            student = profile["student"]
            attempt = ExamAttempt(
                exam_id=completed_exam.id, student_id=student.id, status=AttemptStatus.submitted,
                server_start_time=datetime.utcnow() - timedelta(days=5, minutes=35),
                server_end_time=datetime.utcnow() - timedelta(days=5, minutes=5),
                submitted_at=datetime.utcnow() - timedelta(days=5, minutes=6), consent_given=True,
            )
            db.add(attempt)
            db.flush()

            for i, (text, choices, answer) in enumerate(MCQ_BANK[:10]):
                q = quiz_section.questions[i]
                # Most students answer correctly; sprinkle a couple of misses for realism.
                response = answer if i % 4 != 0 else "A"
                db.add(Answer(attempt_id=attempt.id, question_id=q.id, response=[response], is_answered=True))
            db.flush()
            grade_attempt(db, attempt, completed_exam)
            attempt.result.released = True
            attempt.result.released_at = datetime.utcnow() - timedelta(days=4)

            session = ProctorSession(attempt_id=attempt.id, started_at=attempt.server_start_time,
                                      ended_at=attempt.submitted_at, mode="demo")
            db.add(session)
            db.flush()

            base_time = attempt.server_start_time + timedelta(minutes=5)
            for j, (etype, confidence, duration) in enumerate(profile["events"]):
                db.add(ProctorEvent(
                    session_id=session.id, exam_id=completed_exam.id, attempt_id=attempt.id, student_id=student.id,
                    event_type=EventType(etype), severity=severity_for(etype), confidence=confidence,
                    timestamp=base_time + timedelta(minutes=j * 4), duration_seconds=duration,
                    description=label_for(etype), review_status=ReviewStatus.detected,
                ))
            db.flush()
            recompute_risk(db, session)
            db.commit()

        print("Seed complete.")
        print("Faculty login: faculty@examora.app / Demo@123")
        print("Student login: student@examora.app / Demo@123")
        print(f"Live exam access code: {exam.access_code}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
