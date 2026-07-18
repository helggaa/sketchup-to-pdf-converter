"""
Pydantic v2 data models for the SketchUp-to-PDF Converter PDF Service.

These models mirror the TypeScript types defined in frontend/src/types.ts,
using snake_case field names as per Python conventions.
"""

from __future__ import annotations

import base64
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

# ---------------------------------------------------------------------------
# Shared literal type
# ---------------------------------------------------------------------------

def _camel_alias_generator(field_name: str) -> str:
    return ''.join(
        part if index == 0 else part.capitalize()
        for index, part in enumerate(field_name.split('_'))
    )


PresetViewName = Literal[
    "Top", "Bottom", "Front", "Back", "Left", "Right", "Isometric"
]

# ---------------------------------------------------------------------------
# AnnotationData
# ---------------------------------------------------------------------------


class AnnotationData(BaseModel):
    """Optional text annotation placed on a PDF page."""

    model_config = ConfigDict(alias_generator=_camel_alias_generator, populate_by_name=True)

    title: str = Field(min_length=1, description="View title; must not be empty.")
    scale_label: str = Field(
        default="",
        description='Optional scale label, e.g. "1:100". Empty string means none.',
    )


# ---------------------------------------------------------------------------
# ViewPayload
# ---------------------------------------------------------------------------


class ViewPayload(BaseModel):
    """A single rendered view, ready to become one PDF page."""

    model_config = ConfigDict(alias_generator=lambda x: ''.join(
        word if i == 0 else word.capitalize()
        for i, word in enumerate(x.split('_'))
    ), populate_by_name=True)

    view_name: PresetViewName = Field(
        description="One of the seven predefined architectural view names."
    )
    image_data: str = Field(
        description=(
            "Base64-encoded PNG image at 2480 × 3508 px. "
            "May include a data-URL prefix (data:image/png;base64,...) which will be stripped."
        )
    )
    annotation: Optional[AnnotationData] = Field(
        default=None,
        description="Annotation text for this page, or null when annotation is disabled.",
    )

    @field_validator("image_data", mode="before")
    @classmethod
    def validate_base64(cls, v: str) -> str:
        """Strip optional data-URL prefix and verify the payload is valid base64."""
        if isinstance(v, str) and v.startswith("data:"):
            # e.g. "data:image/png;base64,iVBOR..."
            v = v.split(",", 1)[1]
        try:
            base64.b64decode(v, validate=True)
        except Exception as exc:
            raise ValueError("image_data must be valid base64-encoded content") from exc
        return v


# ---------------------------------------------------------------------------
# RenderPayload
# ---------------------------------------------------------------------------


class RenderPayload(BaseModel):
    """The full payload sent from the Browser Client to the PDF Service."""

    model_config = ConfigDict(alias_generator=_camel_alias_generator, populate_by_name=True)

    views: list[ViewPayload] = Field(
        min_length=1,
        max_length=7,
        description="Ordered list of rendered views; between 1 and 7 items inclusive.",
    )
    filename: str = Field(
        min_length=1,
        description="Base SKP filename without extension, used to name the downloaded PDF.",
    )
