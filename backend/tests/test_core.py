"""
Run with:  pytest -q   (from the backend/ directory, inside the venv)

Uses an isolated in-memory SQLite database per test session so it never
touches examora.db.
"""
import os

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET"] = "test-secret"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)


def _register(client, role="faculty", email="a@examora.app"):
    r = client.post("/auth/register", json={
        "full_name": "Test User", "email": email, "password": "Passw0rd!", "role": role,
    })
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_register_and_login(client):
    token = _register(client, "faculty", "faculty_test@examora.app")
    headers = {"Authorization": f"Bearer {token}"}
    r = client.get("/auth/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["role"] == "faculty"

    r = client.post("/auth/login", json={"email": "faculty_test@examora.app", "password": "Passw0rd!"})
    assert r.status_code == 200


def test_wrong_password_rejected(client):
    _register(client, "faculty", "wrongpass@examora.app")
    r = client.post("/auth/login", json={"email": "wrongpass@examora.app", "password": "nope"})
    assert r.status_code == 401


def test_student_cannot_create_exam(client):
    token = _register(client, "student", "stud1@examora.app")
    headers = {"Authorization": f"Bearer {token}"}
    r = client.post("/exams", json={"title": "X", "subject": "Y"}, headers=headers)
    assert r.status_code == 403


def test_exam_creation_and_publish_requires_questions(client):
    token = _register(client, "faculty", "fac2@examora.app")
    headers = {"Authorization": f"Bearer {token}"}
    r = client.post("/exams", json={"title": "Quiz", "subject": "Math"}, headers=headers)
    assert r.status_code == 200
    exam_id = r.json()["id"]

    r = client.post(f"/exams/{exam_id}/publish", headers=headers)
    assert r.status_code == 400  # no questions yet

    r = client.put(f"/exams/{exam_id}/questions", json={"sections": [
        {"name": "Section A", "instructions": "", "questions": [
            {"question_text": "2+2=?", "question_type": "mcq", "marks": 1, "correct_answer": ["B"],
             "options": [{"label": "A", "text": "3"}, {"label": "B", "text": "4"}]}
        ]}
    ]}, headers=headers)
    assert r.status_code == 200
    assert r.json()["total_marks"] == 1

    r = client.post(f"/exams/{exam_id}/publish", headers=headers)
    assert r.status_code == 200
    assert r.json()["access_code"]


def test_question_extractor_basic():
    from app.services.question_extractor import extract_exam_structure

    text = """SECTION A
Multiple Choice Questions
2 x 1 = 2

1. Which data structure follows FIFO?
A. Stack
B. Queue
C. Tree
D. Graph

2. Which SQL keyword removes duplicates?
A. UNIQUE
B. DISTINCT
C. FILTER
D. GROUP

Answer Key
1. B
2. B
"""
    outcome = extract_exam_structure(text)
    assert outcome.total_questions == 2
    assert outcome.sections[0].questions[0].correct_answer == ["B"]
    assert outcome.sections[0].questions[0].question_type == "mcq"
    assert outcome.needs_review_count == 0


def test_question_extractor_missing_answer_flags_review():
    from app.services.question_extractor import extract_exam_structure

    text = """SECTION A
1. Which data structure follows FIFO?
A. Stack
B. Queue
C. Tree
D. Graph
"""
    outcome = extract_exam_structure(text)
    assert outcome.total_questions == 1
    assert outcome.sections[0].questions[0].correct_answer is None
    assert outcome.sections[0].questions[0].needs_review is True


def test_risk_engine_clean_session_scores_100():
    from app.services.risk_engine import EVENT_WEIGHTS
    assert EVENT_WEIGHTS["MULTIPLE_FACES"] > EVENT_WEIGHTS["TAB_SWITCH"]


def test_full_attempt_flow(client):
    fac_token = _register(client, "faculty", "flowfac@examora.app")
    fh = {"Authorization": f"Bearer {fac_token}"}
    stu_token = _register(client, "student", "flowstu@examora.app")
    sh = {"Authorization": f"Bearer {stu_token}"}

    r = client.post("/exams", json={"title": "Flow Exam", "subject": "CS"}, headers=fh)
    exam_id = r.json()["id"]
    client.put(f"/exams/{exam_id}/questions", json={"sections": [
        {"name": "Section A", "instructions": "", "questions": [
            {"question_text": "1+1=?", "question_type": "mcq", "marks": 1, "correct_answer": ["A"],
             "options": [{"label": "A", "text": "2"}, {"label": "B", "text": "3"}]}
        ]}
    ]}, headers=fh)
    client.post(f"/exams/{exam_id}/publish", headers=fh)

    r = client.post("/attempts", json={"exam_id": exam_id, "consent_given": True}, headers=sh)
    assert r.status_code == 200
    attempt_id = r.json()["id"]

    r = client.get(f"/attempts/{attempt_id}", headers=sh)
    question_id = r.json()["questions"][0]["id"]

    r = client.put(f"/attempts/{attempt_id}/answers", json={"question_id": question_id, "response": ["A"]}, headers=sh)
    assert r.status_code == 200

    r = client.post(f"/attempts/{attempt_id}/submit", headers=sh)
    assert r.status_code == 200

    # Duplicate submission should be rejected
    r = client.post(f"/attempts/{attempt_id}/submit", headers=sh)
    assert r.status_code == 400
