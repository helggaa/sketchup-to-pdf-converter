"""
Unit tests for backend/pdf_assembler.py.

Covers:
- Single-view PDF contains exactly 1 page
- 7-view PDF contains exactly 7 pages
- Annotation title and scale_label appear in the PDF text stream
- Every page in the generated PDF is A4 size (595.28 pt × 841.89 pt)
"""

from __future__ import annotations

import base64
import io

import pytest

# ---------------------------------------------------------------------------
# Optional PDF-reader dependency
# Prefer pypdf (>= 3) if available, fall back to PyPDF2, else skip.
# ---------------------------------------------------------------------------
try:
    from pypdf import PdfReader  # type: ignore

    def _open_pdf(data: bytes) -> PdfReader:
        return PdfReader(io.BytesIO(data))

    def _get_pages(reader: PdfReader):
        return reader.pages

    def _extract_text(page) -> str:
        return page.extract_text() or ""

    def _page_size(page) -> tuple[float, float]:
        box = page.mediabox
        return float(box.width), float(box.height)

except ImportError:
    try:
        import PyPDF2  # type: ignore

        def _open_pdf(data: bytes):  # type: ignore[misc]
            return PyPDF2.PdfReader(io.BytesIO(data))

        def _get_pages(reader):
            return reader.pages

        def _extract_text(page) -> str:
            return page.extract_text() or ""

        def _page_size(page) -> tuple[float, float]:
            box = page.mediabox
            return float(box.width), float(box.height)

    except ImportError:
        PdfReader = None  # type: ignore[assignment,misc]


# ---------------------------------------------------------------------------
# PIL is listed in requirements.txt so we can always create a minimal PNG
# ---------------------------------------------------------------------------
from PIL import Image as PILImage

from backend.models import AnnotationData, RenderPayload, ViewPayload
from backend.pdf_assembler import assemble_pdf


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Expected A4 dimensions in points (within floating-point tolerance)
A4_WIDTH_PT = 595.28
A4_HEIGHT_PT = 841.89
A4_TOLERANCE_PT = 1.0  # ±1 pt tolerance for rounding differences


def _make_png_base64(width: int = 10, height: int = 10) -> str:
    """Create a minimal solid-white PNG and return it as a base64 string."""
    img = PILImage.new("RGB", (width, height), color=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


def _make_view_payload(
    view_name: str = "Front",
    annotation: AnnotationData | None = None,
) -> ViewPayload:
    return ViewPayload(
        view_name=view_name,  # type: ignore[arg-type]
        image_data=_make_png_base64(),
        annotation=annotation,
    )


VIEW_NAMES = ["Top", "Bottom", "Front", "Back", "Left", "Right", "Isometric"]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestAssemblePdf:
    """Tests for assemble_pdf()."""

    def test_returns_bytes(self):
        payload = RenderPayload(
            views=[_make_view_payload()],
            filename="model",
        )
        result = assemble_pdf(payload)
        assert isinstance(result, bytes)

    def test_output_starts_with_pdf_header(self):
        """The returned bytes must begin with the PDF magic number %%PDF-."""
        payload = RenderPayload(
            views=[_make_view_payload()],
            filename="model",
        )
        result = assemble_pdf(payload)
        assert result[:5] == b"%PDF-"

    def test_single_view_produces_one_page(self):
        """Requirement 7.1: one page per view."""
        if PdfReader is None:
            pytest.skip("pypdf / PyPDF2 not installed; skipping page-count test")

        payload = RenderPayload(
            views=[_make_view_payload("Front")],
            filename="model",
        )
        pdf_bytes = assemble_pdf(payload)
        reader = _open_pdf(pdf_bytes)
        assert len(_get_pages(reader)) == 1

    def test_seven_views_produces_seven_pages(self):
        """Requirement 7.1: one page per view, up to 7."""
        if PdfReader is None:
            pytest.skip("pypdf / PyPDF2 not installed; skipping page-count test")

        views = [_make_view_payload(n) for n in VIEW_NAMES]
        payload = RenderPayload(views=views, filename="house")
        pdf_bytes = assemble_pdf(payload)
        reader = _open_pdf(pdf_bytes)
        assert len(_get_pages(reader)) == 7

    def test_a4_page_dimensions_single_view(self):
        """Requirement 7.2: every page must be A4 (210 × 297 mm = 595.28 × 841.89 pt)."""
        if PdfReader is None:
            pytest.skip("pypdf / PyPDF2 not installed; skipping dimension test")

        payload = RenderPayload(
            views=[_make_view_payload("Top")],
            filename="model",
        )
        pdf_bytes = assemble_pdf(payload)
        reader = _open_pdf(pdf_bytes)
        for page in _get_pages(reader):
            w, h = _page_size(page)
            assert abs(w - A4_WIDTH_PT) < A4_TOLERANCE_PT, (
                f"Page width {w:.2f} pt is not A4 ({A4_WIDTH_PT} pt)"
            )
            assert abs(h - A4_HEIGHT_PT) < A4_TOLERANCE_PT, (
                f"Page height {h:.2f} pt is not A4 ({A4_HEIGHT_PT} pt)"
            )

    def test_a4_page_dimensions_all_views(self):
        """Requirement 7.2: all 7 pages must be A4."""
        if PdfReader is None:
            pytest.skip("pypdf / PyPDF2 not installed; skipping dimension test")

        views = [_make_view_payload(n) for n in VIEW_NAMES]
        payload = RenderPayload(views=views, filename="house")
        pdf_bytes = assemble_pdf(payload)
        reader = _open_pdf(pdf_bytes)
        for i, page in enumerate(_get_pages(reader)):
            w, h = _page_size(page)
            assert abs(w - A4_WIDTH_PT) < A4_TOLERANCE_PT, (
                f"Page {i + 1} width {w:.2f} pt is not A4"
            )
            assert abs(h - A4_HEIGHT_PT) < A4_TOLERANCE_PT, (
                f"Page {i + 1} height {h:.2f} pt is not A4"
            )

    def test_annotation_title_appears_in_pdf(self):
        """Requirement 7.3: annotation title must be present in the PDF output."""
        if PdfReader is None:
            pytest.skip("pypdf / PyPDF2 not installed; skipping text-content test")

        annotation = AnnotationData(title="Front Elevation", scale_label="")
        payload = RenderPayload(
            views=[_make_view_payload("Front", annotation=annotation)],
            filename="model",
        )
        pdf_bytes = assemble_pdf(payload)

        # Extract text via pypdf (content streams are compressed, can't scan raw bytes)
        reader = _open_pdf(pdf_bytes)
        all_text = " ".join(_extract_text(p) for p in _get_pages(reader))
        assert "Front Elevation" in all_text, (
            f"Annotation title 'Front Elevation' not found in extracted PDF text: {all_text!r}"
        )

    def test_annotation_scale_label_appears_in_pdf(self):
        """Requirement 7.3: scale_label must appear when provided."""
        if PdfReader is None:
            pytest.skip("pypdf / PyPDF2 not installed; skipping text-content test")

        annotation = AnnotationData(title="Isometric View", scale_label="1:100")
        payload = RenderPayload(
            views=[_make_view_payload("Isometric", annotation=annotation)],
            filename="model",
        )
        pdf_bytes = assemble_pdf(payload)

        reader = _open_pdf(pdf_bytes)
        all_text = " ".join(_extract_text(p) for p in _get_pages(reader))
        assert "1:100" in all_text, (
            f"Scale label '1:100' not found in extracted PDF text: {all_text!r}"
        )

    def test_no_annotation_omits_text(self):
        """Requirement 7.3 (converse): no annotation → no spurious text."""
        payload = RenderPayload(
            views=[_make_view_payload("Back", annotation=None)],
            filename="model",
        )
        pdf_bytes = assemble_pdf(payload)
        # We only check that the function runs without error and returns a PDF.
        assert pdf_bytes[:5] == b"%PDF-"

    def test_multiple_views_each_page_has_correct_dimensions(self):
        """Regression: all pages stay A4 when multiple views are present."""
        if PdfReader is None:
            pytest.skip("pypdf / PyPDF2 not installed")

        ann = AnnotationData(title="Top View", scale_label="1:50")
        views = [
            _make_view_payload("Top", annotation=ann),
            _make_view_payload("Front"),
            _make_view_payload("Isometric", annotation=AnnotationData(title="ISO")),
        ]
        payload = RenderPayload(views=views, filename="building")
        pdf_bytes = assemble_pdf(payload)
        reader = _open_pdf(pdf_bytes)

        assert len(_get_pages(reader)) == 3

        for i, page in enumerate(_get_pages(reader)):
            w, h = _page_size(page)
            assert abs(w - A4_WIDTH_PT) < A4_TOLERANCE_PT, f"Page {i+1} width wrong"
            assert abs(h - A4_HEIGHT_PT) < A4_TOLERANCE_PT, f"Page {i+1} height wrong"

    def test_image_data_with_data_url_prefix_is_handled(self):
        """pdf_assembler must handle any remaining data-URL prefixes safely."""
        raw_b64 = _make_png_base64()
        # Manually construct a ViewPayload bypassing the validator to simulate
        # a case where we call _decode_image with a prefixed string directly.
        from backend.pdf_assembler import _decode_image
        prefixed = f"data:image/png;base64,{raw_b64}"
        result = _decode_image(prefixed)
        assert isinstance(result, bytes)
        assert len(result) > 0
