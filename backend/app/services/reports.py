from __future__ import annotations

import csv
import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.models import Exam, ExamAttempt

BRAND_NAVY = colors.HexColor("#26326B")


def exam_report_pdf(exam: Exam, attempts: list[ExamAttempt]) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm)
    styles = getSampleStyleSheet()
    title_style = styles["Title"]
    title_style.textColor = BRAND_NAVY

    elements = [
        Paragraph("Examora — Examination Report", title_style),
        Spacer(1, 6),
        Paragraph(f"{exam.title} &middot; {exam.subject}", styles["Heading2"]),
        Spacer(1, 12),
    ]

    submitted = [a for a in attempts if a.status.value in ("submitted", "auto_submitted")]
    scores = [a.result.marks_obtained for a in submitted if a.result]
    avg = round(sum(scores) / len(scores), 2) if scores else 0
    passed_count = sum(1 for a in submitted if a.result and a.result.passed)

    summary_rows = [
        ["Total students", str(len(attempts))],
        ["Submitted", str(len(submitted))],
        ["Not submitted", str(len(attempts) - len(submitted))],
        ["Average score", f"{avg} / {exam.total_marks}"],
        ["Highest score", str(max(scores)) if scores else "-"],
        ["Lowest score", str(min(scores)) if scores else "-"],
        ["Pass percentage", f"{round((passed_count / len(submitted)) * 100, 1)}%" if submitted else "-"],
    ]
    summary_table = Table(summary_rows, colWidths=[6 * cm, 6 * cm])
    summary_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E4E5E9")),
    ]))
    elements += [summary_table, Spacer(1, 16), Paragraph("Student Results", styles["Heading3"]), Spacer(1, 6)]

    student_rows = [["Student", "Score", "Percentage", "Result", "Integrity Score", "Risk"]]
    for a in submitted:
        risk = a.proctor_sessions[0].risk_assessment if a.proctor_sessions and a.proctor_sessions[0].risk_assessment else None
        student_rows.append([
            a.student.full_name,
            f"{a.result.marks_obtained}/{a.result.total_marks}" if a.result else "-",
            f"{a.result.percentage}%" if a.result else "-",
            ("Pass" if a.result and a.result.passed else "Fail" if a.result and a.result.passed is False else "Pending"),
            str(risk.score) if risk else "-",
            risk.risk_level.upper() if risk else "-",
        ])
    student_table = Table(student_rows, colWidths=[4.5 * cm, 2.3 * cm, 2.3 * cm, 2 * cm, 2.5 * cm, 2 * cm])
    student_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E4E5E9")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F6F5F1")]),
    ]))
    elements.append(student_table)

    doc.build(elements)
    return buf.getvalue()


def exam_report_csv(exam: Exam, attempts: list[ExamAttempt]) -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Student", "Email", "Status", "Score", "Total Marks", "Percentage", "Result", "Integrity Score", "Risk Level"])
    for a in attempts:
        risk = a.proctor_sessions[0].risk_assessment if a.proctor_sessions and a.proctor_sessions[0].risk_assessment else None
        writer.writerow([
            a.student.full_name,
            a.student.email,
            a.status.value,
            a.result.marks_obtained if a.result else "",
            a.result.total_marks if a.result else exam.total_marks,
            a.result.percentage if a.result else "",
            ("Pass" if a.result and a.result.passed else "Fail" if a.result and a.result.passed is False else "Pending"),
            risk.score if risk else "",
            risk.risk_level if risk else "",
        ])
    return buf.getvalue().encode("utf-8")


def student_integrity_report_pdf(exam: Exam, attempt: ExamAttempt) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm)
    styles = getSampleStyleSheet()
    styles["Title"].textColor = BRAND_NAVY

    session = attempt.proctor_sessions[0] if attempt.proctor_sessions else None
    risk = session.risk_assessment if session else None

    elements = [
        Paragraph("Examora — Student Integrity Report", styles["Title"]),
        Spacer(1, 6),
        Paragraph(f"{attempt.student.full_name} &middot; {exam.title}", styles["Heading2"]),
        Spacer(1, 12),
        Paragraph(f"Integrity Score: {risk.score if risk else 'N/A'} / 100 ({(risk.risk_level.upper() if risk else 'N/A')} RISK)", styles["Heading3"]),
        Spacer(1, 8),
    ]

    if risk:
        elements.append(Paragraph("Reasons:", styles["Normal"]))
        for reason in risk.reasons:
            elements.append(Paragraph(f"&bull; {reason}", styles["Normal"]))
        elements.append(Spacer(1, 12))

    elements.append(Paragraph("Event Timeline", styles["Heading3"]))
    rows = [["Time", "Event", "Severity", "Confidence", "Status"]]
    if session:
        for e in sorted(session.events, key=lambda x: x.timestamp):
            rows.append([
                e.timestamp.strftime("%H:%M:%S"), e.description, e.severity.value.upper(),
                f"{round(e.confidence * 100)}%", e.review_status.value.replace("_", " ").title(),
            ])
    table = Table(rows, colWidths=[2.3 * cm, 6.5 * cm, 2.5 * cm, 2.5 * cm, 3 * cm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E4E5E9")),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 10))
    elements.append(Paragraph(
        "This report reflects system-detected activity only. It is an indicator, "
        "not proof of academic misconduct. All findings require authorized faculty review.",
        styles["Italic"],
    ))

    doc.build(elements)
    return buf.getvalue()
