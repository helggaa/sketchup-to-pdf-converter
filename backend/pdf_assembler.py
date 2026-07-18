"""
PDF assembler for the SketchUp-to-PDF Converter PDF Service.

Converts a RenderPayload into a multi-page A4 PDF using ReportLab's
low-level canvas API for precise control over layout.
Each view occupies exactly one A4 page; optional annotation text is
drawn directly onto the canvas so it overlays the image.
"""

from __future__ import annotations

import base64
import io

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from backend.models import RenderPayload

# ---------------------------------------------------------------------------
# A4 page dimensions (points)
# ---------------------------------------------------------------------------

PAGE_W, PAGE_H = A4  # 595.28 pt × 841.89 pt

# Annotation styling constants
_FOOTER_MARGIN = 10 * mm
_TITLE_FONT = "Helvetica-Bold"
_TITLE_SIZE = 14
_SCALE_FONT = "Helvetica"
_SCALE_SIZE = 10
_TEXT_LEFT = 8 * mm


def assemble_pdf(payload: RenderPayload) -> bytes:
    """
    Assemble a multi-page A4 PDF from a RenderPayload.

    Each view in ``payload.views`` becomes exactly one A4 page.
    If the view has annotation data, the title (and optional scale label)
    are drawn as a text overlay near the bottom of the page.

    Returns the PDF as raw bytes.
    """
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    c.setPageSize((PAGE_W, PAGE_H))

    for view in payload.views:
        # Decode image bytes
        img_bytes = _decode_image(view.image_data)

        # Draw the image filling the entire A4 page
        img_reader = ImageReader(io.BytesIO(img_bytes))
        c.drawImage(
            img_reader,
            x=0,
            y=0,
            width=PAGE_W,
            height=PAGE_H,
            preserveAspectRatio=False,
            mask="auto",
        )

        # Draw annotation overlay on top of image if present
        if view.annotation:
            _draw_annotation(c, view.annotation.title, view.annotation.scale_label)

        # Commit this page and start the next
        c.showPage()

    c.save()
    return buffer.getvalue()


def _draw_annotation(c: canvas.Canvas, title: str, scale_label: str = "") -> None:
    """Draw annotation title and optional scale label near the bottom of the page."""
    c.saveState()

    # Calculate background strip height
    strip_h = _TITLE_SIZE + 6
    if scale_label:
        strip_h += _SCALE_SIZE + 4

    # Semi-transparent white background strip for readability
    c.setFillColorRGB(1, 1, 1, alpha=0.75)
    c.rect(
        0,
        _FOOTER_MARGIN - 4,
        PAGE_W,
        strip_h,
        fill=1,
        stroke=0,
    )

    # Title text
    c.setFillColorRGB(0, 0, 0)
    c.setFont(_TITLE_FONT, _TITLE_SIZE)
    title_y = _FOOTER_MARGIN + (_SCALE_SIZE + 4 if scale_label else 0)
    c.drawString(_TEXT_LEFT, title_y, title)

    # Scale label (below title)
    if scale_label:
        c.setFont(_SCALE_FONT, _SCALE_SIZE)
        c.drawString(_TEXT_LEFT, _FOOTER_MARGIN, scale_label)

    c.restoreState()


def _decode_image(image_data: str) -> bytes:
    """
    Decode a base64 image string, stripping any data-URL prefix if present.
    The Pydantic validator in models.py already handles this, but we guard
    here too for safety.
    """
    if image_data.startswith("data:"):
        image_data = image_data.split(",", 1)[1]
    return base64.b64decode(image_data)
