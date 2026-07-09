"""Audit report generation — turns a persisted Scan into a branded PDF.

Renders entirely in memory (BytesIO) so the API can stream the bytes without
touching disk. Content is derived only from stored scan metadata + the
compliance knowledge base — consistent with our "no raw PII at rest" rule, the
report never contains the original sensitive values, only types/counts/score.

Sections: cover header · executive summary · risk summary · PII inventory ·
compliance findings · recommended actions · footer disclaimer.
"""
from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.db.models.scan import Scan
from app.db.models.user import User
from app.services import compliance

# Brand palette (mirrors the frontend accent).
_ACCENT = colors.HexColor("#6366f1")
_INK = colors.HexColor("#11131a")
_DIM = colors.HexColor("#54607a")
_RISK_COLORS = {
    "low": colors.HexColor("#22c55e"),
    "medium": colors.HexColor("#eab308"),
    "high": colors.HexColor("#f97316"),
    "critical": colors.HexColor("#ef4444"),
}


def _hex(color: colors.Color) -> str:
    """'#rrggbb' string for use inside ReportLab <font color="..."> markup."""
    return "#" + color.hexval()[2:]


def _styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("t", parent=base["Title"], textColor=_INK, fontSize=22,
                                 spaceAfter=2, alignment=TA_LEFT),
        "subtitle": ParagraphStyle("s", parent=base["Normal"], textColor=_DIM, fontSize=10,
                                    spaceAfter=2),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], textColor=_ACCENT, fontSize=13,
                             spaceBefore=14, spaceAfter=6),
        "body": ParagraphStyle("b", parent=base["Normal"], textColor=_INK, fontSize=9.5,
                               leading=14),
        "small": ParagraphStyle("sm", parent=base["Normal"], textColor=_DIM, fontSize=8,
                                leading=11),
        "cell": ParagraphStyle("c", parent=base["Normal"], textColor=_INK, fontSize=8.5,
                               leading=12),
        "cellhead": ParagraphStyle("ch", parent=base["Normal"], textColor=colors.white,
                                   fontSize=8.5, leading=12),
    }


class ReportService:
    def build_pdf(self, scan: Scan, owner: User) -> bytes:
        s = _styles()
        buf = BytesIO()
        doc = SimpleDocTemplate(
            buf, pagesize=A4,
            topMargin=18 * mm, bottomMargin=18 * mm,
            leftMargin=18 * mm, rightMargin=18 * mm,
            title=f"Privacy Audit Report — {scan.id}",
            author="North Star",
        )
        story: list = []

        # --- Header ---
        story.append(Paragraph("North Star", s["subtitle"]))
        story.append(Paragraph("Privacy Audit Report", s["title"]))
        generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        meta_line = (
            f"Scan ID {scan.id} &nbsp;·&nbsp; Owner {owner.email} "
            f"&nbsp;·&nbsp; Generated {generated}"
        )
        story.append(Paragraph(meta_line, s["small"]))
        story.append(Spacer(1, 6))
        story.append(HRFlowable(width="100%", color=_ACCENT, thickness=1.2))

        types = [item["type"] for item in (scan.findings_summary or [])]

        # --- Executive summary ---
        story.append(Paragraph("Executive Summary", s["h2"]))
        story.append(Paragraph(self._exec_summary(scan, types), s["body"]))

        # --- Risk summary ---
        story.append(Paragraph("Risk Summary", s["h2"]))
        story.append(self._risk_table(scan, s))

        # --- PII inventory ---
        story.append(Paragraph("PII Inventory", s["h2"]))
        story.append(self._inventory_table(scan, s))

        # --- Compliance findings ---
        story.append(Paragraph("Compliance Findings (GDPR &amp; India DPDP)", s["h2"]))
        story.append(self._compliance_table(types, s))

        # --- Recommended actions ---
        story.append(Paragraph("Recommended Actions", s["h2"]))
        for i, action in enumerate(self._recommended_actions(scan, types), 1):
            story.append(Paragraph(f"{i}. {action}", s["body"]))
            story.append(Spacer(1, 2))

        # --- Footer ---
        story.append(Spacer(1, 14))
        story.append(HRFlowable(width="100%", color=colors.HexColor("#e3e6ec"), thickness=0.8))
        story.append(Paragraph(
            "This report is generated automatically from scan metadata and is provided for "
            "decision-support only. It is not legal advice. Article/section references are "
            "indicative; consult a qualified professional for compliance decisions.",
            s["small"],
        ))

        doc.build(story)
        return buf.getvalue()

    # --- Incident digest (for management) -----------------------------------

    def build_incident_digest(self, incidents: list, days: int = 7) -> bytes:
        """A management digest: which employees sent sensitive data despite a
        warning, over the last ``days``. Only masked snippets/metadata — no raw PII."""
        s = _styles()
        buf = BytesIO()
        doc = SimpleDocTemplate(
            buf, pagesize=A4, topMargin=18 * mm, bottomMargin=18 * mm,
            leftMargin=16 * mm, rightMargin=16 * mm,
            title="North Star — Incident Digest", author="North Star",
        )
        story: list = []
        story.append(Paragraph("North Star", s["subtitle"]))
        story.append(Paragraph("Data-Loss Incident Digest", s["title"]))
        generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        story.append(Paragraph(
            f"Last {days} day(s) &nbsp;·&nbsp; {len(incidents)} incident(s) "
            f"&nbsp;·&nbsp; Generated {generated}", s["small"]))
        story.append(Spacer(1, 6))
        story.append(HRFlowable(width="100%", color=_ACCENT, thickness=1.2))

        if not incidents:
            story.append(Paragraph("Summary", s["h2"]))
            story.append(Paragraph(
                "No incidents in this period — no employee sent flagged sensitive "
                "data after a warning. 🎉", s["body"]))
            doc.build(story)
            return buf.getvalue()

        # Per-employee tally
        by_emp: dict[str, int] = {}
        by_type: dict[str, int] = {}
        for inc in incidents:
            label = getattr(inc, "actor_label", None) or "unknown"
            by_emp[label] = by_emp.get(label, 0) + 1
            for item in getattr(inc, "findings_summary", None) or []:
                by_type[item["type"]] = by_type.get(item["type"], 0) + int(item.get("count", 0))

        story.append(Paragraph("Summary", s["h2"]))
        emp_sorted = sorted(by_emp.items(), key=lambda kv: -kv[1])[:5]
        type_sorted = sorted(by_type.items(), key=lambda kv: -kv[1])[:6]
        top_emp = ", ".join(f"{e} ({n})" for e, n in emp_sorted)
        top_types = ", ".join(f"{t} ({n})" for t, n in type_sorted)
        story.append(Paragraph(
            f"<b>{len(incidents)}</b> incident(s) across <b>{len(by_emp)}</b> employee(s). "
            f"Most incidents: {top_emp or '—'}. Most-shared data: {top_types or '—'}.", s["body"]))

        story.append(Paragraph("Incidents", s["h2"]))
        rows = [[
            Paragraph("Employee", s["cellhead"]), Paragraph("When (UTC)", s["cellhead"]),
            Paragraph("Site", s["cellhead"]), Paragraph("Risk", s["cellhead"]),
            Paragraph("Data (masked)", s["cellhead"]),
        ]]
        for inc in incidents[:60]:
            created = getattr(inc, "created_at", None)
            when = created.strftime("%Y-%m-%d %H:%M") if created else "—"
            summary = inc.findings_summary or []
            types = ", ".join(f"{i['type']}×{i['count']}" for i in summary) or "—"
            snippet = (inc.masked_snippet or "").strip()
            if len(snippet) > 90:
                snippet = snippet[:90] + "…"
            sev = _hex(_RISK_COLORS.get(inc.risk_level, _DIM))
            rows.append([
                Paragraph(str(inc.actor_label or "—"), s["cell"]),
                Paragraph(when, s["cell"]),
                Paragraph(str(inc.site or "—"), s["cell"]),
                Paragraph(f'<font color="{sev}"><b>{inc.risk_level.upper()}</b></font>', s["cell"]),
                Paragraph(f"{types}<br/><font color='#8a93a6'>{snippet}</font>", s["cell"]),
            ])
        story.append(self._styled_table(rows, [30 * mm, 26 * mm, 26 * mm, 18 * mm, None]))

        story.append(Spacer(1, 12))
        story.append(HRFlowable(width="100%", color=colors.HexColor("#e3e6ec"), thickness=0.8))
        story.append(Paragraph(
            "Generated from masked metadata only — original sensitive values are never "
            "stored or transmitted. For internal security awareness use.", s["small"]))
        doc.build(story)
        return buf.getvalue()

    # --- Section builders ---------------------------------------------------

    @staticmethod
    def _exec_summary(scan: Scan, types: list[str]) -> str:
        if scan.entity_count == 0:
            return ("No personal data was detected in the scanned content. The privacy risk "
                    "for this item is <b>low</b>.")
        distinct = ", ".join(compliance.rule_for(t).label for t in types) or "personal data"
        return (
            f"This scan detected <b>{scan.entity_count}</b> instance(s) of personal data across "
            f"<b>{len(types)}</b> data type(s): {distinct}. The overall privacy risk is "
            f"<b>{scan.risk_level.upper()}</b> with a score of <b>{scan.risk_score}/100</b>. "
            "The findings and obligations below should be remediated before this content is "
            "shared or stored."
        )

    def _risk_table(self, scan: Scan, s: dict) -> Table:
        risk_hex = _hex(_RISK_COLORS.get(scan.risk_level, _DIM))
        level_markup = f'<b><font color="{risk_hex}">{scan.risk_level.upper()}</font></b>'

        def kv(label: str, value: str) -> list:
            return [Paragraph(label, s["cell"]), Paragraph(value, s["cell"])]

        data = [
            kv("Risk score", f"<b>{scan.risk_score} / 100</b>"),
            kv("Risk level", level_markup),
            kv("PII instances", str(scan.entity_count)),
            kv("Characters scanned", str(scan.char_count)),
        ]
        t = Table(data, colWidths=[45 * mm, None])
        t.setStyle(TableStyle([
            ("LINEBELOW", (0, 0), (-1, -2), 0.4, colors.HexColor("#e3e6ec")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        return t

    def _inventory_table(self, scan: Scan, s: dict) -> Table:
        rows = [[Paragraph("Data type", s["cellhead"]),
                 Paragraph("Count", s["cellhead"]),
                 Paragraph("Max confidence", s["cellhead"])]]
        summary = scan.findings_summary or []
        if not summary:
            rows.append([Paragraph("None detected", s["cell"]), Paragraph("0", s["cell"]),
                         Paragraph("—", s["cell"])])
        for item in summary:
            rule = compliance.rule_for(item["type"])
            rows.append([
                Paragraph(f"{rule.label} <font color='#8a93a6'>({item['type']})</font>", s["cell"]),
                Paragraph(str(item.get("count", 0)), s["cell"]),
                Paragraph(f"{int(item.get('max_confidence', 0) * 100)}%", s["cell"]),
            ])
        return self._styled_table(rows, [None, 22 * mm, 30 * mm])

    def _compliance_table(self, types: list[str], s: dict) -> Table:
        rows = [[Paragraph("Data type", s["cellhead"]),
                 Paragraph("Severity", s["cellhead"]),
                 Paragraph("GDPR", s["cellhead"]),
                 Paragraph("India DPDP", s["cellhead"])]]
        pairs = compliance.findings_for_types(types)
        if not pairs:
            rows.append([Paragraph("No obligations triggered", s["cell"]),
                         Paragraph("—", s["cell"]), Paragraph("—", s["cell"]),
                         Paragraph("—", s["cell"])])
        for _t, rule in pairs:
            sev_hex = _hex(_RISK_COLORS.get(rule.severity, _DIM))
            sev_markup = f'<font color="{sev_hex}"><b>{rule.severity.upper()}</b></font>'
            rows.append([
                Paragraph(rule.label, s["cell"]),
                Paragraph(sev_markup, s["cell"]),
                Paragraph(rule.gdpr, s["cell"]),
                Paragraph(rule.dpdp, s["cell"]),
            ])
        return self._styled_table(rows, [38 * mm, 20 * mm, None, None])

    @staticmethod
    def _recommended_actions(scan: Scan, types: list[str]) -> list[str]:
        if scan.entity_count == 0:
            return ["No action required — no personal data detected."]
        actions: list[str] = []
        seen: set[str] = set()
        for _t, rule in compliance.findings_for_types(types):
            if rule.recommendation not in seen:
                actions.append(rule.recommendation)
                seen.add(rule.recommendation)
        actions.append(
            "Record the lawful basis (consent/contract) and retention period for this data, "
            "and log this assessment in your audit trail."
        )
        return actions

    @staticmethod
    def _styled_table(rows: list, col_widths: list) -> Table:
        t = Table(rows, colWidths=col_widths, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), _ACCENT),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f5f6fa")]),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e3e6ec")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ]))
        return t
