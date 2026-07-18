# Implementation Plan: SketchUp-to-PDF Converter

## Overview

Implement the hybrid web application incrementally: start with the project scaffold and shared types, build the React frontend (upload → parse → viewport → view selection → annotations → thumbnails → export), then build the FastAPI PDF service, and finally wire the full export flow end-to-end. Property-based and unit tests are added close to the code they exercise.

---

## Tasks

- [x] 1. Scaffold project structure and shared types
  - Create the monorepo layout: `frontend/` (Vite + React + TypeScript) and `backend/` (FastAPI + Python) directories
  - Define TypeScript types: `PresetViewName`, `PresetView`, `PRESET_VIEWS`, `ParsedModel`, `AnnotationData`, `ViewPayload`, `RenderPayload`, `AppState` in `frontend/src/types.ts`
  - Define Pydantic models in `backend/models.py`: `AnnotationData`, `ViewPayload`, `RenderPayload`
  - Set up `frontend/src/context/AppContext.tsx` with the `AppState` interface and an initial-state factory
  - _Requirements: 1, 2, 3, 5, 6, 7_

- [x] 2. Implement file upload and validation
  - [x] 2.1 Create `frontend/src/utils/fileValidation.ts` implementing `validateSkpFile`
    - Enforce `.skp` extension check and 200 MB size limit as specified in `FileValidationResult`
    - _Requirements: 1.1, 1.2, 1.6, 1.7_
  - [ ]* 2.2 Write property tests for `validateSkpFile`
    - **Property 1: File extension validation rejects non-SKP files**
    - **Validates: Requirements 1.2**
    - **Property 2: File size validation enforces the 200 MB limit**
    - **Validates: Requirements 1.6, 1.7**
  - [x] 2.3 Build `frontend/src/components/UploadZone.tsx`
    - Render `<input type="file" accept=".skp" aria-label="Upload SketchUp file" />` with drag-and-drop support
    - On file selection call `validateSkpFile`; on error update `parseError` and show `<ErrorBanner />`
    - On valid file dispatch to `AppContext` and begin parsing (set `parseStatus = 'parsing'`, show `<LoadingOverlay />`)
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7_
  - [ ]* 2.4 Write unit tests for `UploadZone`
    - Test drag-and-drop acceptance and rejection paths
    - Test loading overlay appearance during parsing
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 3. Implement SKP parser module
  - [x] 3.1 Create `frontend/src/parsers/skpParser.ts` exposing `parseSkpFile(file: File): Promise<ParsedModel>`
    - Integrate the `sketchup-file-reader` library (or WASM port); populate `geometries`, `materials`, and `boundingBox`
    - On success set `parseStatus = 'success'` and `model`; on failure set `parseStatus = 'error'` and `parseError`
    - _Requirements: 1.3, 1.4, 1.5_
  - [ ]* 3.2 Write unit tests for `parseSkpFile`
    - Test successful parse populates all three model fields
    - Test parser error propagates to `parseError`
    - _Requirements: 1.4, 1.5_

- [x] 4. Implement Three.js interactive viewport
  - [x] 4.1 Create `frontend/src/components/ThreeViewport.tsx`
    - Initialise `THREE.WebGLRenderer` (antialias), populate scene from `ParsedModel`, default camera to Isometric view
    - Implement `requestAnimationFrame` render loop; target ≥ 30 fps
    - _Requirements: 2.1, 2.2, 2.5_
  - [-] 4.2 Implement camera switching in `ThreeViewport`
    - On `activePreviewView` change, tween camera position from `PresetView.cameraDirection` + bounding-box center using `THREE.MathUtils.lerp` over ~16 frames (≤ 500 ms)
    - Render `<ViewLabel />` showing the active view name below/above the canvas
    - _Requirements: 2.3, 2.4_
  - [ ]* 4.3 Write property test for view label display
    - **Property 3: Active preset view name is always displayed**
    - **Validates: Requirements 2.4**
  - [ ]* 4.4 Write unit tests for camera switching
    - Test transition completes within 500 ms budget
    - Test `ViewLabel` text matches the active preset view name
    - _Requirements: 2.3, 2.4_

- [~] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement view selection panel
  - [-] 6.1 Create `frontend/src/components/ViewSelector.tsx`
    - Render all seven preset views inside `<fieldset>` + `<legend>`; each toggle is `<button role="checkbox" aria-checked>`
    - On activate: add view to `selectedViews`; on deactivate: remove view; display count badge
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [ ]* 6.2 Write property tests for view selection toggle
    - **Property 4: View selection toggle is consistent**
    - **Validates: Requirements 3.2, 3.3**
    - **Property 5: Selected view count reflects actual selection**
    - **Validates: Requirements 3.4, 3.5**
  - [ ]* 6.3 Write unit tests for `ViewSelector`
    - Test each preset view button is rendered
    - Test aria-checked state changes on toggle
    - Test count badge updates correctly
    - _Requirements: 3.1, 3.4, 3.5_

- [ ] 7. Implement thumbnail preview panel
  - [-] 7.1 Create `frontend/src/renderers/thumbnailRenderer.ts` exposing `renderThumbnail(scene, view, boundingBox): Promise<string>`
    - Use an offscreen `THREE.WebGLRenderer` at 320 × 453 px; return a base64 data URL
    - _Requirements: 4.1_
  - [~] 7.2 Create `frontend/src/components/ThumbnailPreviewPanel.tsx`
    - For each view in `selectedViews`, show its thumbnail in display order; remove thumbnail when view is deselected
    - Trigger thumbnail regeneration when `model` changes
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [ ]* 7.3 Write property test for thumbnail panel mirroring
    - **Property 6: Thumbnail panel mirrors selected views**
    - **Validates: Requirements 4.1, 4.3, 4.4**
  - [ ]* 7.4 Write unit tests for `ThumbnailPreviewPanel`
    - Test thumbnails appear for each added selected view
    - Test thumbnails are removed when view is deselected
    - _Requirements: 4.1, 4.4_

- [ ] 8. Implement annotation panel
  - [-] 8.1 Create `frontend/src/components/AnnotationPanel.tsx`
    - Render enable/disable toggle; for each selected view render `<label for="..."><input id="...">` pairs for title and scale label
    - Default title to `PresetView` name via `defaultAnnotation()`; allow custom override
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  - [ ]* 8.2 Write property tests for annotation data
    - **Property 7: Annotation defaults to preset view name**
    - **Validates: Requirements 5.2**
    - **Property 8: Custom annotation overrides default and scale label is preserved**
    - **Validates: Requirements 5.3, 5.5**
    - **Property 9: Disabled annotation produces empty annotation payload**
    - **Validates: Requirements 5.6**
  - [ ]* 8.3 Write unit tests for `AnnotationPanel`
    - Test toggle enables and disables all annotation fields
    - Test custom title overrides default
    - Test scale label included only when annotation is enabled
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6_

- [~] 9. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement high-resolution renderer and export control
  - [-] 10.1 Create `frontend/src/renderers/highResRenderer.ts` exposing `renderViewHighRes(scene, view, boundingBox): Promise<string>`
    - Render at 2480 × 3508 px using a fresh offscreen `THREE.WebGLRenderer`; return base64 PNG data URL
    - _Requirements: 6.1_
  - [ ]* 10.2 Write property test for high-resolution render dimensions
    - **Property 10: High-resolution renders meet minimum dimensions**
    - **Validates: Requirements 6.1**
  - [~] 10.3 Create `frontend/src/utils/exportFlow.ts` implementing the export orchestration function
    - Guard: if `selectedViews.size === 0` surface validation message and return (Req 6.2)
    - Set `exportStatus = 'rendering'`, disable export button; for each selected view call `renderViewHighRes`
    - Assemble `RenderPayload` using `derivePdfFilename`; set `exportStatus = 'uploading'`; POST to `/generate-pdf`
    - On 200: convert response blob to object URL, trigger `<a download>` click, revoke URL, set `exportStatus = 'done'`
    - On error: set `exportStatus = 'error'`, `exportError = message`; re-enable button
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 8.1, 8.2, 8.3_
  - [x] 10.4 Create `frontend/src/utils/filename.ts` implementing `derivePdfFilename(skpFilename: string): string`
    - Strip extension from SKP filename and append `-views.pdf`
    - _Requirements: 8.2_
  - [ ]* 10.5 Write property test for download filename derivation
    - **Property 15: Download filename follows the naming pattern**
    - **Validates: Requirements 8.2**
  - [~] 10.6 Create `frontend/src/components/ExportButton.tsx`
    - Render export button with `aria-busy` during export and `aria-disabled` when no views selected
    - Show progress indicator while `exportStatus` is `'rendering'` or `'uploading'`; hide when `'done'`
    - _Requirements: 6.2, 6.4, 8.3_
  - [ ]* 10.7 Write unit tests for export flow
    - Test validation message shown when no views selected
    - Test button is disabled during export
    - Test error message shown on HTTP failure
    - _Requirements: 6.2, 6.4, 6.5_

- [x] 11. Implement FastAPI PDF service
  - [x] 11.1 Create `backend/main.py` with FastAPI app and `POST /generate-pdf` route
    - Import `RenderPayload` Pydantic model from `backend/models.py`; invoke `assemble_pdf`; return `Response(content=pdf_bytes, media_type="application/pdf", headers={...})`
    - Add custom exception handler to format Pydantic `ValidationError` as `{"detail": "..."}` with HTTP 400
    - _Requirements: 7.1, 7.4, 7.5_
  - [x] 11.2 Create `backend/pdf_assembler.py` implementing `assemble_pdf(payload: RenderPayload) -> bytes`
    - Use `reportlab` `SimpleDocTemplate` with A4 pagesize, zero margins; for each view decode base64 image, place full-page `Image`, append annotation paragraphs, append page break
    - _Requirements: 7.1, 7.2, 7.3_
  - [ ]* 11.3 Write property tests for PDF page count and order
    - **Property 11: PDF page count and order match the Render Payload**
    - **Validates: Requirements 7.1**
  - [ ]* 11.4 Write property test for PDF page dimensions
    - **Property 12: Every generated PDF page is A4 size**
    - **Validates: Requirements 7.2**
  - [ ]* 11.5 Write property test for annotation placement
    - **Property 13: Annotation data appears on the correct PDF page**
    - **Validates: Requirements 7.3**
  - [ ]* 11.6 Write property test for invalid payload responses
    - **Property 14: Invalid or incomplete payloads produce HTTP 400**
    - **Validates: Requirements 7.5**
  - [ ]* 11.7 Write unit tests for `assemble_pdf`
    - Test single-view PDF contains exactly one page
    - Test seven-view PDF contains exactly seven pages
    - Test annotation title and scale label appear on correct page
    - _Requirements: 7.1, 7.2, 7.3_

- [~] 12. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Implement responsive layout and accessibility polish
  - [~] 13.1 Create `frontend/src/layouts/MainLayout.tsx` using CSS Grid two-column layout
    - Viewport column: `flex-grow`; side panel: fixed 360 px; `min-width: 0` on both children
    - Add responsive breakpoints: side panel collapses to drawer / bottom sheet below full width
    - _Requirements: 9.1_
  - [ ]* 13.2 Write property test for responsive layout
    - **Property 16: Responsive layout produces no horizontal overflow**
    - **Validates: Requirements 9.1**
  - [~] 13.3 Audit and apply accessibility attributes across all components
    - Add `:focus-visible` outlines; verify `aria-label`, `aria-busy`, `aria-disabled`, `aria-checked`, `role="img"` are set correctly
    - Verify keyboard navigation reaches every interactive control
    - _Requirements: 9.2, 9.3, 9.4_

- [ ] 14. Wire full application together
  - [~] 14.1 Assemble `frontend/src/App.tsx` composing all components under `AppContext.Provider`
    - Render `<UploadZone />`, `<LoadingOverlay />`, `<ErrorBanner />`, and `<MainLayout>` with `<ViewportPanel>` and `<SidePanel>` containing `<ViewSelector />`, `<AnnotationPanel />`, `<ThumbnailPreviewPanel />`, `<ExportButton />`
    - Wire all context state changes through the component tree
    - _Requirements: 1, 2, 3, 4, 5, 6, 8, 9_
  - [ ]* 14.2 Write integration tests for the full export flow
    - Mock the `/generate-pdf` endpoint; test complete path from file upload through PDF download
    - Test error path: server returns 400, verify error message shown and button re-enabled
    - _Requirements: 6.3, 6.4, 6.5, 7.5, 8.1, 8.2, 8.3_

- [~] 15. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints (tasks 5, 9, 12, 15) ensure incremental validation throughout development
- Property tests validate universal correctness properties defined in the design document
- Unit tests validate specific examples and edge cases
- The frontend uses Vite + React + TypeScript + Three.js; the backend uses FastAPI + Pydantic v2 + ReportLab + Pillow

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "3.1"] },
    { "id": 1, "tasks": ["2.2", "2.3", "3.2", "4.1", "11.1", "11.2", "10.4"] },
    { "id": 2, "tasks": ["2.4", "4.2", "6.1", "7.1", "8.1", "10.1", "10.3", "11.3", "11.4", "11.5", "11.6", "11.7"] },
    { "id": 3, "tasks": ["4.3", "4.4", "6.2", "6.3", "7.2", "7.3", "7.4", "8.2", "8.3", "10.2", "10.5", "10.6", "10.7", "13.1"] },
    { "id": 4, "tasks": ["13.2", "13.3", "14.1"] },
    { "id": 5, "tasks": ["14.2"] }
  ]
}
```
