"""
Question extraction engine.

Converts raw extracted document text into a structured exam:
sections -> questions -> options, with per-field confidence scores.

This is the deterministic "rules" AI_PROVIDER: a carefully tuned
regex/heuristics pipeline that requires no external API key and works
offline. It is intentionally conservative - it NEVER invents an answer
key, marks value, or option that is not actually present in the
document; anything inferred rather than explicitly read gets a lower
confidence score and needs_review=True so a human confirms it.

Swapping AI_PROVIDER=llm in app/config.py routes the same interface
(`extract_exam_structure`) through app/ai/llm_provider.py instead,
without any caller-side changes - see that module for the seam.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

SECTION_RE = re.compile(r"^\s*SECTION\s+([A-Z0-9]+)\b[:\-]?\s*(.*)$", re.IGNORECASE)
MARKS_SCHEME_RE = re.compile(r"(\d+)\s*[×xX*]\s*(\d+(?:\.\d+)?)\s*=\s*(\d+(?:\.\d+)?)")
QUESTION_START_RE = re.compile(r"^\s*(\d{1,3})[\.\)]\s+(.*)$")
OPTION_RE = re.compile(r"^\s*[\(\[]?([A-Da-d])[\)\.\]]\s+(.*)$")
INLINE_MARKS_RE = re.compile(r"[\[\(]\s*(\d+(?:\.\d+)?)\s*marks?\s*[\]\)]", re.IGNORECASE)
INLINE_ANSWER_RE = re.compile(r"^\s*(?:Ans(?:wer)?)\s*[:\-]\s*([A-Da-d](?:\s*,\s*[A-Da-d])*)\s*$", re.IGNORECASE)
ANSWER_KEY_HEADER_RE = re.compile(r"^\s*(answer\s*key|answers)\s*[:\-]?\s*$", re.IGNORECASE)
ANSWER_KEY_LINE_RE = re.compile(r"^\s*(\d{1,3})\s*[\.\)\-:]\s*([A-Da-d](?:\s*,\s*[A-Da-d])*)\s*$")
TRUE_FALSE_HINT_RE = re.compile(r"true\s*/\s*false|true\s+or\s+false", re.IGNORECASE)
MULTI_SELECT_HINT_RE = re.compile(r"select all|choose all|more than one|multiple\s*select", re.IGNORECASE)


@dataclass
class ExtractedOption:
    label: str
    text: str
    order: int


@dataclass
class ExtractedQuestion:
    number: str
    text: str
    question_type: str
    marks: float
    options: list[ExtractedOption] = field(default_factory=list)
    correct_answer: list[str] | None = None
    ai_generated_answer: bool = False
    confidence: dict = field(default_factory=dict)
    needs_review: bool = False


@dataclass
class ExtractedSection:
    name: str
    instructions: str
    questions: list[ExtractedQuestion] = field(default_factory=list)
    marks_scheme_detected: bool = False


@dataclass
class ExtractionOutcome:
    sections: list[ExtractedSection]
    total_questions: int
    total_marks: float
    needs_review_count: int
    warnings: list[str]


def extract_exam_structure(raw_text: str) -> ExtractionOutcome:
    lines = [ln.rstrip() for ln in raw_text.splitlines()]
    lines = [ln for ln in lines if ln.strip() != ""]

    sections: list[ExtractedSection] = []
    answer_key: dict[str, list[str]] = {}
    warnings: list[str] = []

    current_section: ExtractedSection | None = None
    current_question: ExtractedQuestion | None = None
    section_default_marks: float = 1.0
    in_answer_key_block = False

    def flush_question():
        nonlocal current_question
        if current_question is not None and current_section is not None:
            _finalize_question(current_question)
            current_section.questions.append(current_question)
        current_question = None

    for raw_line in lines:
        line = raw_line.strip()

        if ANSWER_KEY_HEADER_RE.match(line):
            in_answer_key_block = True
            flush_question()
            continue

        if in_answer_key_block:
            m = ANSWER_KEY_LINE_RE.match(line)
            if m:
                qnum, letters = m.groups()
                answer_key[qnum] = [x.strip().upper() for x in letters.split(",")]
                continue
            # A non-matching line ends the answer key block.
            in_answer_key_block = False

        sec_match = SECTION_RE.match(line)
        if sec_match:
            flush_question()
            label, rest = sec_match.groups()
            name = f"Section {label}" + (f" - {rest.strip()}" if rest.strip() else "")
            current_section = ExtractedSection(name=name, instructions="")
            sections.append(current_section)
            section_default_marks = 1.0
            continue

        if current_section is not None and not current_question and not current_section.questions:
            # Lines right after a section header, before the first question,
            # are treated as the section's descriptive instructions
            # (e.g. "Multiple Choice Questions", "10 × 1 = 10").
            marks_match = MARKS_SCHEME_RE.search(line)
            if marks_match:
                _, each, _total = marks_match.groups()
                section_default_marks = float(each)
                current_section.instructions = (current_section.instructions + " " + line).strip()
                current_section.marks_scheme_detected = True
                continue
            if not QUESTION_START_RE.match(line):
                current_section.instructions = (current_section.instructions + " " + line).strip()
                continue

        q_match = QUESTION_START_RE.match(line)
        if q_match:
            flush_question()
            if current_section is None:
                current_section = ExtractedSection(name="Section A", instructions="")
                sections.append(current_section)
            number, text = q_match.groups()
            current_question = ExtractedQuestion(
                number=number,
                text=text.strip(),
                question_type="mcq",
                marks=section_default_marks,
            )
            if not current_section.marks_scheme_detected:
                current_question.confidence["marks_default"] = True
            inline_marks = INLINE_MARKS_RE.search(text)
            if inline_marks:
                current_question.marks = float(inline_marks.group(1))
                current_question.confidence["marks_explicit"] = True
                current_question.text = INLINE_MARKS_RE.sub("", current_question.text).strip()
            continue

        opt_match = OPTION_RE.match(line)
        if opt_match and current_question is not None:
            opt_label, opt_text = opt_match.groups()
            current_question.options.append(
                ExtractedOption(label=opt_label.upper(), text=opt_text.strip(), order=len(current_question.options))
            )
            continue

        ans_match = INLINE_ANSWER_RE.match(line)
        if ans_match and current_question is not None:
            letters = [x.strip().upper() for x in ans_match.group(1).split(",")]
            current_question.correct_answer = letters
            current_question.ai_generated_answer = True
            continue

        # Otherwise: continuation of the current question's text.
        if current_question is not None:
            current_question.text = (current_question.text + " " + line).strip()
        elif current_section is not None:
            current_section.instructions = (current_section.instructions + " " + line).strip()

    flush_question()

    # Apply answer key (explicit, out-of-band answers) where not already set inline.
    for section in sections:
        for question in section.questions:
            if question.correct_answer is None and question.number in answer_key:
                question.correct_answer = answer_key[question.number]
                question.ai_generated_answer = True

    # Classify question types now that we know option counts + section context.
    for section in sections:
        lower_name = section.name.lower() + " " + section.instructions.lower()
        for question in section.questions:
            question.question_type = _classify_type(question, lower_name)
            _score_confidence(question)

    sections = [s for s in sections if s.questions]
    total_questions = sum(len(s.questions) for s in sections)
    total_marks = sum(q.marks for s in sections for q in s.questions)
    needs_review_count = sum(1 for s in sections for q in s.questions if q.needs_review)

    if total_questions == 0:
        warnings.append(
            "No questions could be automatically detected. The document may not "
            "follow a numbered-question format, or OCR quality may be low. "
            "You can still build the exam manually."
        )
    if not answer_key:
        warnings.append(
            "No standalone answer key was found in the document. Any answers shown "
            "were read from inline 'Ans:' markers only, and questions without one "
            "are flagged for manual review."
        )

    return ExtractionOutcome(sections, total_questions, total_marks, needs_review_count, warnings)


def _classify_type(q: ExtractedQuestion, section_context: str) -> str:
    if MULTI_SELECT_HINT_RE.search(section_context) and q.options:
        return "multi_select"
    if "multiple choice" in section_context or "mcq" in section_context:
        return "mcq" if q.options else "short_answer"
    if TRUE_FALSE_HINT_RE.search(section_context) or TRUE_FALSE_HINT_RE.search(q.text):
        return "true_false"
    if "long answer" in section_context or "essay" in section_context:
        return "long_answer"
    if "descriptive" in section_context:
        return "descriptive"
    if "short answer" in section_context:
        return "short_answer"

    # Fallback purely on structure.
    if len(q.options) >= 2:
        return "mcq"
    if q.marks <= 2:
        return "short_answer"
    return "long_answer"


def _score_confidence(q: ExtractedQuestion) -> None:
    conf = q.confidence
    conf["question"] = 0.97 if len(q.text) > 8 else 0.6

    if q.question_type in ("mcq", "multi_select"):
        expected = 4
        found = len(q.options)
        conf["options"] = round(min(found / expected, 1.0) * 0.97, 2) if found else 0.0
        if found < 2:
            q.needs_review = True
    else:
        conf["options"] = 1.0  # not applicable

    conf["marks"] = 0.95 if conf.get("marks_explicit") else (0.6 if conf.get("marks_default") else 0.9)
    conf.pop("marks_explicit", None)
    conf.pop("marks_default", None)

    conf["type"] = 0.9

    if q.correct_answer:
        conf["answer"] = 0.85 if q.ai_generated_answer else 0.99
    else:
        conf["answer"] = 0.0
        if q.question_type in ("mcq", "multi_select", "true_false"):
            q.needs_review = True

    if q.question_type in ("long_answer", "descriptive"):
        # Descriptive questions have no machine-checkable answer; that's expected.
        conf["answer"] = 1.0
        q.needs_review = q.needs_review or conf["options"] < 0.3 if q.options else q.needs_review

    if any(v < 0.8 for k, v in conf.items() if k != "answer"):
        q.needs_review = True


def _finalize_question(q: ExtractedQuestion) -> None:
    # Ensure options are re-ordered / labeled consistently A, B, C...
    for i, opt in enumerate(q.options):
        opt.order = i
