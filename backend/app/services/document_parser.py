"""
Text extraction layer.

Turns an uploaded PDF / DOCX / JPG / PNG into plain text that the
question extractor can then parse. OCR (pytesseract) is only invoked
when a PDF page yields no selectable text (i.e. it's a scan) or the
upload is an image - this keeps normal typed PDFs fast.
"""
from __future__ import annotations

import io
import logging

from PIL import Image

logger = logging.getLogger("examora.document_parser")


class ExtractionResult:
    def __init__(self, text: str, used_ocr: bool, page_count: int = 1):
        self.text = text
        self.used_ocr = used_ocr
        self.page_count = page_count


def extract_text(file_bytes: bytes, filename: str, content_type: str) -> ExtractionResult:
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""

    if ext == "pdf" or content_type == "application/pdf":
        return _extract_pdf(file_bytes)
    if ext == "docx" or "wordprocessingml" in content_type:
        return _extract_docx(file_bytes)
    if ext in ("jpg", "jpeg", "png") or content_type.startswith("image/"):
        return _extract_image(file_bytes)

    raise ValueError(f"Unsupported file type: {filename} ({content_type})")


def _extract_pdf(file_bytes: bytes) -> ExtractionResult:
    import pdfplumber

    text_parts: list[str] = []
    used_ocr = False
    page_count = 0

    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        page_count = len(pdf.pages)
        for page in pdf.pages:
            page_text = (page.extract_text() or "").strip()
            if len(page_text) < 20:
                # Likely a scanned page - fall back to OCR on a rasterized image.
                try:
                    pil_image = page.to_image(resolution=200).original
                    ocr_text = _ocr_image(pil_image)
                    if len(ocr_text) > len(page_text):
                        page_text = ocr_text
                        used_ocr = True
                except Exception:  # pragma: no cover - environment dependent
                    logger.warning("OCR fallback failed for a page; keeping extracted text")
            text_parts.append(page_text)

    return ExtractionResult("\n\n".join(text_parts), used_ocr, page_count)


def _extract_docx(file_bytes: bytes) -> ExtractionResult:
    import docx

    document = docx.Document(io.BytesIO(file_bytes))
    lines = [p.text for p in document.paragraphs]

    for table in document.tables:
        for row in table.rows:
            lines.append(" | ".join(cell.text for cell in row.cells))

    return ExtractionResult("\n".join(lines), used_ocr=False, page_count=1)


def _extract_image(file_bytes: bytes) -> ExtractionResult:
    image = Image.open(io.BytesIO(file_bytes))
    text = _ocr_image(image)
    return ExtractionResult(text, used_ocr=True, page_count=1)


def _ocr_image(image: Image.Image) -> str:
    try:
        import pytesseract
        return pytesseract.image_to_string(image)
    except Exception:  # pragma: no cover - tesseract binary may be absent
        logger.warning(
            "pytesseract/tesseract binary unavailable in this environment; "
            "returning empty OCR text. Install the tesseract-ocr system package "
            "to enable scanned-document support."
        )
        return ""
