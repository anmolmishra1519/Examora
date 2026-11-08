from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.models import Answer, Exam, ExamAttempt, ExamResult, Question

OBJECTIVE_TYPES = {"mcq", "multi_select", "true_false"}
SUBJECTIVE_TYPES = {"short_answer", "long_answer", "descriptive"}


def _answer_matches(question: Question, response) -> bool:
    correct = question.correct_answer
    if correct is None or response is None:
        return False
    if isinstance(correct, list):
        given = response if isinstance(response, list) else [response]
        return sorted(str(x).strip().upper() for x in given) == sorted(str(x).strip().upper() for x in correct)
    return str(response).strip().upper() == str(correct).strip().upper()


def grade_attempt(db: Session, attempt: ExamAttempt, exam: Exam) -> ExamResult:
    questions = {q.id: q for s in exam.sections for q in s.questions}
    answers_by_q = {a.question_id: a for a in attempt.answers}

    correct = incorrect = unanswered = pending = 0
    marks_obtained = 0.0
    total_marks = sum(q.marks for q in questions.values())

    for qid, question in questions.items():
        answer: Answer | None = answers_by_q.get(qid)
        has_response = answer is not None and answer.is_answered

        if not has_response:
            unanswered += 1
            if answer is not None:
                answer.is_correct = None
                answer.marks_awarded = 0
            continue

        if question.question_type.value in OBJECTIVE_TYPES:
            if question.correct_answer is None:
                # No verified answer key exists for this question - cannot
                # be auto-graded; faculty must grade it manually.
                pending += 1
                answer.is_correct = None
                answer.marks_awarded = None
                continue

            is_correct = _answer_matches(question, answer.response)
            answer.is_correct = is_correct
            if is_correct:
                correct += 1
                answer.marks_awarded = question.marks
                marks_obtained += question.marks
            else:
                incorrect += 1
                penalty = question.negative_marks if exam.negative_marking else 0
                answer.marks_awarded = -penalty
                marks_obtained -= penalty
        else:
            # Subjective / descriptive - always requires manual grading,
            # unless a faculty member has already graded it.
            if answer.manually_graded and answer.marks_awarded is not None:
                marks_obtained += answer.marks_awarded
            else:
                pending += 1
                answer.is_correct = None
                answer.marks_awarded = None

    percentage = round((marks_obtained / total_marks) * 100, 2) if total_marks else 0.0
    fully_graded = pending == 0
    passed = (marks_obtained >= exam.passing_marks) if fully_graded else None

    result = attempt.result
    if result is None:
        result = ExamResult(attempt_id=attempt.id)
        db.add(result)

    result.total_marks = total_marks
    result.marks_obtained = round(max(marks_obtained, 0.0), 2)
    result.correct_count = correct
    result.incorrect_count = incorrect
    result.unanswered_count = unanswered
    result.pending_manual_grading = pending
    result.percentage = percentage
    result.passed = passed

    db.commit()
    db.refresh(result)
    return result
