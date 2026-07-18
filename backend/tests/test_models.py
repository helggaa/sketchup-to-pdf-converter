"""Unit tests for backend/models.py Pydantic models."""

import base64

import pytest
from pydantic import ValidationError

from backend.models import AnnotationData, RenderPayload, ViewPayload


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_image_data() -> str:
    """Return a minimal valid base64 string (1-byte payload)."""
    return base64.b64encode(b"\x00").decode()


def _make_view_payload(**overrides) -> dict:
    defaults = {
        "view_name": "Front",
        "image_data": _make_image_data(),
        "annotation": None,
    }
    defaults.update(overrides)
    return defaults


# ---------------------------------------------------------------------------
# AnnotationData
# ---------------------------------------------------------------------------


class TestAnnotationData:
    def test_valid_annotation(self):
        ann = AnnotationData(title="Front View", scale_label="1:100")
        assert ann.title == "Front View"
        assert ann.scale_label == "1:100"

    def test_scale_label_defaults_to_empty(self):
        ann = AnnotationData(title="Top")
        assert ann.scale_label == ""

    def test_empty_title_raises(self):
        with pytest.raises(ValidationError):
            AnnotationData(title="")


# ---------------------------------------------------------------------------
# ViewPayload
# ---------------------------------------------------------------------------


class TestViewPayload:
    def test_valid_view_payload(self):
        vp = ViewPayload(**_make_view_payload())
        assert vp.view_name == "Front"
        assert vp.annotation is None

    def test_all_seven_view_names_accepted(self):
        names = ["Top", "Bottom", "Front", "Back", "Left", "Right", "Isometric"]
        for name in names:
            vp = ViewPayload(**_make_view_payload(view_name=name))
            assert vp.view_name == name

    def test_invalid_view_name_raises(self):
        with pytest.raises(ValidationError):
            ViewPayload(**_make_view_payload(view_name="Diagonal"))

    def test_data_url_prefix_is_stripped(self):
        raw = _make_image_data()
        data_url = f"data:image/png;base64,{raw}"
        vp = ViewPayload(**_make_view_payload(image_data=data_url))
        assert not vp.image_data.startswith("data:")

    def test_invalid_base64_raises(self):
        with pytest.raises(ValidationError):
            ViewPayload(**_make_view_payload(image_data="!!!not-base64!!!"))

    def test_annotation_present(self):
        ann = {"title": "Front", "scale_label": "1:50"}
        vp = ViewPayload(**_make_view_payload(annotation=ann))
        assert vp.annotation is not None
        assert vp.annotation.title == "Front"
        assert vp.annotation.scale_label == "1:50"


# ---------------------------------------------------------------------------
# RenderPayload
# ---------------------------------------------------------------------------


class TestRenderPayload:
    def test_valid_single_view_payload(self):
        payload = RenderPayload(
            views=[_make_view_payload()],
            filename="MyModel",
        )
        assert len(payload.views) == 1
        assert payload.filename == "MyModel"

    def test_valid_seven_view_payload(self):
        views = [
            _make_view_payload(view_name=n)
            for n in ["Top", "Bottom", "Front", "Back", "Left", "Right", "Isometric"]
        ]
        payload = RenderPayload(views=views, filename="House")
        assert len(payload.views) == 7

    def test_empty_views_raises(self):
        with pytest.raises(ValidationError):
            RenderPayload(views=[], filename="Model")

    def test_too_many_views_raises(self):
        views = [_make_view_payload() for _ in range(8)]
        with pytest.raises(ValidationError):
            RenderPayload(views=views, filename="Model")

    def test_empty_filename_raises(self):
        with pytest.raises(ValidationError):
            RenderPayload(views=[_make_view_payload()], filename="")
