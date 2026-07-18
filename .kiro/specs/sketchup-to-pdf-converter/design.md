# Design Document

## Introduction

This document describes the architecture, components, data models, and interfaces for the SketchUp-to-PDF Converter — a hybrid web application where the Browser Client (React/TypeScript + Three.js) handles SKP parsing and interactive 3D preview, while the PDF Service (Python/FastAPI) assembles the final high-resolution PDF.

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser Client                        │
│                                                             │
│  ┌──────────┐   ┌──────────────┐   ┌────────────────────┐  │
│  │  Upload  │──▶│  SKP Parser  │──▶│  Three.js Renderer │  │
│  │ Component│   │  (WASM/JS)   │   │  (Viewport + HR    │  │
│  └──────────┘   └──────────────┘   │   Export Renderer) │  │
│                                    └────────┬───────────┘  │
│  ┌──────────────────────────────────────┐   │              │
│  │        View Selection Panel          │◀──┘              │
│  │  (PresetView toggles + count badge)  │                  │
│  └──────────────────────────────────────┘                  │
│  ┌──────────────────────────────────────┐                  │
│  │        Annotation Panel              │                  │
│  │  (title fields + scale label fields) │                  │
│  └──────────────────────────────────────┘                  │
│  ┌──────────────────────────────────────┐                  │
│  │        Thumbnail Preview Panel       │                  │
│  └──────────────────────────────────────┘                  │
│  ┌──────────────────────────────────────┐                  │
│  │        Export Control                │                  │
│  └──────────────────────────────────────┘                  │
│                        │ HTTP POST /generate-pdf            │
└────────────────────────┼────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                        PDF Service (FastAPI)                  │
│                                                             │
│  ┌─────────────────┐   ┌──────────────┐   ┌─────────────┐  │
│  │  Request        │──▶│  PDF         │──▶│  Response   │  │
│  │  Validator      │   │  Assembler   │   │  Handler    │  │
│  └─────────────────┘   └──────────────┘   └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

The Browser Client and PDF Service communicate through a single REST endpoint. The client is a single-page application (SPA) served as static files; the PDF Service is a standalone FastAPI process that can be deployed independently.

---

## Browser Client Architecture

### Component Tree

```
<App>
  <UploadZone />                    // Req 1: file input + drag-drop
  <LoadingOverlay />                // Req 1.3: parse progress
  <ErrorBanner />                   // Req 1.2, 1.5, 1.7, 6.5
  <MainLayout>                      // Two-column layout (Req 9.1)
    <ViewportPanel>
      <ThreeViewport />             // Req 2: interactive preview
      <ViewLabel />                 // Req 2.4: active view name
    </ViewportPanel>
    <SidePanel>
      <ViewSelector />              // Req 3: preset view toggles
      <AnnotationPanel />           // Req 5: title + scale inputs
      <ThumbnailPreviewPanel />     // Req 4: per-view thumbnails
      <ExportButton />              // Req 6: export + progress
    </SidePanel>
  </MainLayout>
</App>
```

### State Management

A single React context (`AppContext`) holds global state. Local component state is used only for transient UI (e.g., hover styles).

```typescript
interface AppState {
  // File & parse state
  uploadedFile: File | null;
  parseStatus: 'idle' | 'parsing' | 'success' | 'error';
  parseError: string | null;
  model: ParsedModel | null;

  // View selection
  selectedViews: Set<PresetViewName>;
  activePreviewView: PresetViewName;

  // Annotation
  annotationEnabled: boolean;
  annotations: Record<PresetViewName, AnnotationData>;

  // Thumbnails
  thumbnails: Record<PresetViewName, string>; // data URLs

  // Export
  exportStatus: 'idle' | 'rendering' | 'uploading' | 'done' | 'error';
  exportError: string | null;
}
```

### Preset Views

```typescript
type PresetViewName = 'Top' | 'Bottom' | 'Front' | 'Back' | 'Left' | 'Right' | 'Isometric';

interface PresetView {
  name: PresetViewName;
  // Camera position as a unit vector direction (from target)
  cameraDirection: [number, number, number];
  orthographic: boolean;
}

const PRESET_VIEWS: Record<PresetViewName, PresetView> = {
  Top:       { name: 'Top',       cameraDirection: [0,  1,  0], orthographic: true  },
  Bottom:    { name: 'Bottom',    cameraDirection: [0, -1,  0], orthographic: true  },
  Front:     { name: 'Front',     cameraDirection: [0,  0,  1], orthographic: true  },
  Back:      { name: 'Back',      cameraDirection: [0,  0, -1], orthographic: true  },
  Left:      { name: 'Left',      cameraDirection: [-1, 0,  0], orthographic: true  },
  Right:     { name: 'Right',     cameraDirection: [1,  0,  0], orthographic: true  },
  Isometric: { name: 'Isometric', cameraDirection: [1,  1,  1], orthographic: false },
};
```

---

## SKP Parser Module

SketchUp's binary `.skp` format is parsed in the browser. The recommended library is [`sketchup-file-reader`](https://github.com/nicholasgasior/sketchup-file-reader) or a compiled WASM port. The parser module exposes a single async function:

```typescript
interface ParsedModel {
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
  boundingBox: THREE.Box3;
}

async function parseSkpFile(file: File): Promise<ParsedModel>
```

If the parser throws, the error message is surfaced in `parseError` state.

---

## Three.js Renderer

### Interactive Viewport (`ThreeViewport`)

- Uses `THREE.WebGLRenderer` with `antialias: true`.
- Maintains a `THREE.Scene` populated from `ParsedModel`.
- Camera switching: on preset view selection, the camera position/orientation is computed from the `PresetView.cameraDirection` and the model's bounding box center. Transitions complete within the 500 ms budget (Req 2.3) using `THREE.MathUtils.lerp` over ~16 frames at 60 fps.
- Frame rate: requestAnimationFrame loop; no heavy postprocessing to maintain ≥30 fps (Req 2.5).

### High-Resolution Export Renderer

When export is triggered, a separate offscreen `THREE.WebGLRenderer` renders at 2480 × 3508 px (A4 at 300 dpi):

```typescript
async function renderViewHighRes(
  scene: THREE.Scene,
  view: PresetView,
  boundingBox: THREE.Box3
): Promise<string> // returns base64-encoded PNG data URL
```

This renderer is created fresh per export to avoid conflicts with the interactive viewport.

### Thumbnail Renderer

Thumbnails use the same `renderViewHighRes` approach but at a reduced size (e.g., 320 × 453 px) to maintain aspect ratio and performance.

---

## Annotation Data Model

```typescript
interface AnnotationData {
  title: string;          // Custom title or default PresetView name
  scaleLabel: string;     // e.g., "1:100"; empty string if not provided
}

// Default factory
function defaultAnnotation(viewName: PresetViewName): AnnotationData {
  return { title: viewName, scaleLabel: '' };
}
```

---

## Render Payload (Client → Server)

```typescript
interface ViewPayload {
  viewName: PresetViewName;
  imageData: string;        // base64-encoded PNG, 2480×3508 px
  annotation: AnnotationData | null; // null when annotation disabled
}

interface RenderPayload {
  views: ViewPayload[];     // ordered; 1–7 items
  filename: string;         // base SKP filename without extension
}
```

Transmitted as `application/json` via HTTP POST to `/generate-pdf`.

---

## PDF Service (FastAPI)

### Endpoint

```
POST /generate-pdf
Content-Type: application/json
Body: RenderPayload (JSON)

200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="<filename>-views.pdf"
Body: <binary PDF>

400 Bad Request
Content-Type: application/json
Body: { "detail": "<validation error description>" }
```

### Request Validator

Uses Pydantic v2 models for strict validation:

```python
from pydantic import BaseModel, Field, field_validator
from typing import Literal, Optional
import base64, re

PresetViewName = Literal["Top","Bottom","Front","Back","Left","Right","Isometric"]

class AnnotationData(BaseModel):
    title: str = Field(min_length=1)
    scale_label: str = ""

class ViewPayload(BaseModel):
    view_name: PresetViewName
    image_data: str  # base64 PNG
    annotation: Optional[AnnotationData] = None

    @field_validator("image_data")
    @classmethod
    def validate_base64(cls, v: str) -> str:
        # Strip data-URL prefix if present
        if v.startswith("data:"):
            v = v.split(",", 1)[1]
        try:
            base64.b64decode(v, validate=True)
        except Exception:
            raise ValueError("image_data must be valid base64")
        return v

class RenderPayload(BaseModel):
    views: list[ViewPayload] = Field(min_length=1, max_length=7)
    filename: str = Field(min_length=1)
```

Pydantic validation errors are automatically converted to HTTP 400 by FastAPI's default exception handler. A custom handler formats them as `{ "detail": "..." }`.

### PDF Assembler

Uses [`reportlab`](https://www.reportlab.com/docs/reportlab-userguide.pdf) for PDF generation:

```python
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Image, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
import io, base64
from PIL import Image as PILImage

def assemble_pdf(payload: RenderPayload) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                            leftMargin=0, rightMargin=0,
                            topMargin=0, bottomMargin=0)
    story = []
    styles = getSampleStyleSheet()
    page_w, page_h = A4  # 595.28 pt × 841.89 pt

    for view in payload.views:
        img_bytes = base64.b64decode(view.image_data)
        img = Image(io.BytesIO(img_bytes), width=page_w, height=page_h)
        story.append(img)
        if view.annotation:
            story.append(Paragraph(view.annotation.title, styles["Heading2"]))
            if view.annotation.scale_label:
                story.append(Paragraph(view.annotation.scale_label, styles["Normal"]))
        story.append(_PageBreak())  # custom flowable

    doc.build(story)
    return buffer.getvalue()
```

### Response Handler

```python
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response

app = FastAPI()

@app.post("/generate-pdf")
async def generate_pdf(payload: RenderPayload) -> Response:
    pdf_bytes = assemble_pdf(payload)
    filename = f"{payload.filename}-views.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
```

---

## File Validation Logic (Client-side)

```typescript
type FileValidationResult =
  | { valid: true; file: File }
  | { valid: false; error: 'WRONG_EXTENSION' | 'FILE_TOO_LARGE' };

const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB

function validateSkpFile(file: File): FileValidationResult {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext !== 'skp') {
    return { valid: false, error: 'WRONG_EXTENSION' };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: 'FILE_TOO_LARGE' };
  }
  return { valid: true, file };
}
```

---

## Export Flow (Client-side)

```
1. User clicks Export
   ├─ selectedViews.size === 0 → show validation message, stop
   └─ selectedViews.size > 0 → continue

2. Set exportStatus = 'rendering'
   Disable Export button

3. For each view in selectedViews (in display order):
   a. renderViewHighRes(scene, presetViews[view], model.boundingBox)
   b. Collect base64 PNG string

4. Assemble RenderPayload:
   { views: [...], filename: uploadedFile.name without extension }

5. Set exportStatus = 'uploading'
   POST /generate-pdf with payload

6a. Success (200):
    Blob → object URL → <a download> click → URL.revokeObjectURL
    Set exportStatus = 'done'
    Re-enable Export button
    Hide progress indicator

6b. Failure (non-200 or network error):
    Set exportStatus = 'error', exportError = message
    Re-enable Export button
```

---

## Download Filename Derivation

```typescript
function derivePdfFilename(skpFilename: string): string {
  // Remove extension: "MyModel.skp" → "MyModel"
  const base = skpFilename.replace(/\.[^.]+$/, '');
  return `${base}-views.pdf`;
}
```

---

## Responsive Layout Strategy

- CSS Grid two-column layout: viewport (flex-grow) + side panel (fixed 360 px).
- At narrower breakpoints within 1024–2560 px range, the side panel collapses to a drawer or bottom sheet.
- `min-width: 0` on grid children prevents horizontal overflow.
- All widths expressed in `%` or `fr` units; no fixed pixel widths wider than the minimum viewport.

---

## Accessibility Implementation

- `<input type="file" accept=".skp" aria-label="Upload SketchUp file" />`
- View selector: `<fieldset>` + `<legend>` grouping; each toggle is `<button role="checkbox" aria-checked>`.
- Annotation inputs: `<label for="...">` + `<input id="...">` pairs.
- Export button: `aria-busy` during export; `aria-disabled` when no views selected.
- Focus visible styles: `:focus-visible` outline on all interactive elements.
- `<ThreeViewport>` canvas: `aria-label="3D model preview"` + `role="img"`.

---

## Error Handling Summary

| Scenario | Where handled | User-facing message |
|---|---|---|
| Wrong file extension | Client `validateSkpFile` | "Only .skp files are supported." |
| File exceeds 200 MB | Client `validateSkpFile` | "File exceeds the 200 MB size limit." |
| SKP parse failure | Client parse error handler | "Failed to parse SKP file: `<reason>`." |
| Export with no views | Client pre-export check | "Please select at least one view before exporting." |
| PDF Service HTTP error | Client fetch error handler | "PDF generation failed: `<status> <message>`." |
| Network error | Client fetch catch | "Could not reach the PDF service. Please try again." |
| Invalid payload (server) | FastAPI Pydantic validation | HTTP 400 `{ "detail": "..." }` |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: File extension validation rejects non-SKP files

*For any* filename whose extension is not `.skp` (including files with no extension, wrong extension, or multiple extensions where the final one is not `.skp`), the `validateSkpFile` function SHALL return `{ valid: false, error: 'WRONG_EXTENSION' }`.

**Validates: Requirements 1.2**

---

### Property 2: File size validation enforces the 200 MB limit

*For any* file size value, `validateSkpFile` SHALL accept it (returning `valid: true`) if the size is ≤ 200 × 1024 × 1024 bytes and reject it (returning `{ valid: false, error: 'FILE_TOO_LARGE' }`) if the size exceeds that threshold — regardless of filename.

**Validates: Requirements 1.6, 1.7**

---

### Property 3: Active preset view name is always displayed

*For any* Preset View name in `{ Top, Bottom, Front, Back, Left, Right, Isometric }`, after the view is set as the active preview view, the viewport label SHALL display exactly that view's name.

**Validates: Requirements 2.4**

---

### Property 4: View selection toggle is consistent

*For any* Preset View, activating it SHALL add it to `selectedViews`; subsequently deactivating it SHALL remove it, restoring the prior state. The set of `selectedViews` before and after a complete toggle cycle SHALL be identical.

**Validates: Requirements 3.2, 3.3**

---

### Property 5: Selected view count reflects actual selection

*For any* subset of Preset Views of size n (where 0 ≤ n ≤ 7), the count displayed in the interface SHALL equal n.

**Validates: Requirements 3.4, 3.5**

---

### Property 6: Thumbnail panel mirrors selected views

*For any* set of Selected Views, the set of thumbnails shown in the preview panel SHALL be in one-to-one correspondence with `selectedViews`, and the order of thumbnails SHALL match the order of views in the resulting Render Payload.

**Validates: Requirements 4.1, 4.3, 4.4**

---

### Property 7: Annotation defaults to preset view name

*For any* Preset View with annotation enabled and no custom title entered, the `AnnotationData.title` for that view SHALL equal the Preset View's name string.

**Validates: Requirements 5.2**

---

### Property 8: Custom annotation overrides default and scale label is preserved

*For any* non-empty custom title string set for a view, and *for any* non-empty scale label string set for that view, the `AnnotationData` for that view SHALL contain exactly those values in `title` and `scale_label` respectively when annotation is enabled.

**Validates: Requirements 5.3, 5.5**

---

### Property 9: Disabled annotation produces empty annotation payload

*For any* application state with annotation toggled off, the `annotation` field for every view in the assembled Render Payload SHALL be `null`, regardless of what annotation text has been entered.

**Validates: Requirements 5.6**

---

### Property 10: High-resolution renders meet minimum dimensions

*For any* Selected View, the image produced by `renderViewHighRes` SHALL have a pixel width ≥ 2480 and pixel height ≥ 3508.

**Validates: Requirements 6.1**

---

### Property 11: PDF page count and order match the Render Payload

*For any* valid Render Payload containing n views (1 ≤ n ≤ 7), the generated PDF SHALL contain exactly n pages, and the content of the i-th page SHALL correspond to the i-th view in the payload's `views` array.

**Validates: Requirements 7.1**

---

### Property 12: Every generated PDF page is A4 size

*For any* page in any PDF generated by the PDF Service, the page dimensions SHALL be 210 mm × 297 mm (A4 portrait).

**Validates: Requirements 7.2**

---

### Property 13: Annotation data appears on the correct PDF page

*For any* Render Payload view that contains non-null `annotation` data, the corresponding PDF page SHALL contain the view's `title` string and, if `scale_label` is non-empty, the `scale_label` string.

**Validates: Requirements 7.3**

---

### Property 14: Invalid or incomplete payloads produce HTTP 400

*For any* request body sent to `POST /generate-pdf` that is missing a required field, contains an out-of-range value, or contains malformed `image_data`, the PDF Service SHALL respond with HTTP 400 and a JSON body containing a `"detail"` key.

**Validates: Requirements 7.5**

---

### Property 15: Download filename follows the naming pattern

*For any* uploaded SKP file with base name `<basename>` (the filename with the `.skp` extension removed), the file downloaded after a successful export SHALL be named `<basename>-views.pdf`.

**Validates: Requirements 8.2**

---

### Property 16: Responsive layout produces no horizontal overflow

*For any* viewport width w where 1024 px ≤ w ≤ 2560 px, the Browser Client layout SHALL not produce horizontal scrollbar or overflow at that width.

**Validates: Requirements 9.1**
