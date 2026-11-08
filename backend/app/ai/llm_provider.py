"""
Optional LLM-backed extraction path.

The default AI_PROVIDER is "rules" (see services/question_extractor.py),
which needs no API key and runs fully offline. If an operator sets
AI_PROVIDER=llm and AI_API_KEY in the environment, route extraction
through this module instead - it should return the exact same
ExtractionOutcome shape so app/services/exam_ai_service.py doesn't care
which provider produced it.

This is left as a clean extension point rather than wired to a specific
vendor, since the brief asks for a modular interface so models can be
swapped later rather than a hard dependency on one paid API.
"""
from app.services.question_extractor import ExtractionOutcome, extract_exam_structure


def extract_with_llm(raw_text: str, api_key: str) -> ExtractionOutcome:
    # Plug in a real call to your LLM provider of choice here, prompting it
    # to return the same {sections -> questions -> options} JSON shape used
    # by the rules engine, then map that JSON into ExtractionOutcome.
    #
    # Falling back to the deterministic rules engine keeps the product
    # functional (rather than throwing) when this hasn't been wired up yet.
    return extract_exam_structure(raw_text)
