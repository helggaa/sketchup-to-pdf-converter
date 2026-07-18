# Requirements Document

## Introduction

This document defines requirements for a web-based application that converts 3D SketchUp (SKP) model files into PDF documents. Users upload an SKP file, preview it from a set of predefined architectural views using an interactive browser-based renderer, select one or more views, and export those views to a paginated PDF. The system uses a hybrid architecture: the browser handles SKP parsing and interactive 3D preview via Three.js, while a Python/FastAPI backend receives rendered frame data and assembles the final high-quality PDF.

## Glossary

- **Application**: The full web-based SketchUp-to-PDF converter system, comprising the Browser Client and the PDF Service.
- **Browser Client**: The React/TypeScript + Three.js frontend running in the user's web browser.
- **PDF Service**: The Python/FastAPI backend responsible for assembling and returning the final PDF document.
- **SKP File**: A binary 3D model file in the SketchUp format (.skp extension) uploaded by the user.
- **Model**: The parsed 3D geometry and material data extracted from the SKP File and held in browser memory.
- **Preset View**: A named, predefined camera configuration representing a standard architectural viewing angle. Supported preset views are: Top, Bottom, Front, Back, Left, Right, and Isometric.
- **View Preview**: A rendered 2D image of the Model from a specific Preset View, displayed interactively in the Browser Client using Three.js.
- **Selected View**: A Preset View explicitly chosen by the user for inclusion in the exported PDF.
- **Render Payload**: A collection of high-resolution image data (one per Selected View) and associated metadata sent from the Browser Client to the PDF Service.
- **PDF Page**: A single page within the generated PDF document, containing one rendered view image and optional annotation.
- **Annotation**: Optional text placed on a PDF Page, consisting of a view title and an optional scale label.
- **Export**: The end-to-end action of rendering Selected Views at high resolution, sending the Render Payload to the PDF Service, and downloading the resulting PDF.

---

## Requirements

### Requirement 1: SKP File Upload

**User Story:** As a user, I want to upload a SketchUp SKP file from my local machine, so that the application can parse and display my 3D model.

#### Acceptance Criteria

1. THE Browser Client SHALL provide a file upload control that accepts files with the `.skp` extension.
2. WHEN the user selects a file with an extension other than `.skp`, THE Browser Client SHALL display an error message indicating that only `.skp` files are supported.
3. WHEN the user selects a valid `.skp` file, THE Browser Client SHALL begin parsing the SKP File and display a loading indicator until parsing is complete.
4. WHEN parsing of the SKP File completes successfully, THE Browser Client SHALL load the resulting Model into the Three.js scene.
5. IF the SKP File cannot be parsed due to an unsupported format version or file corruption, THEN THE Browser Client SHALL display an error message describing the failure and allow the user to upload a different file.
6. THE Browser Client SHALL support SKP files up to 200 MB in size.
7. IF the selected file exceeds 200 MB, THEN THE Browser Client SHALL reject the file and display a message stating the size limit.

---

### Requirement 2: Interactive 3D Preview

**User Story:** As a user, I want to see a live 3D preview of my uploaded model, so that I can visually confirm the model loaded correctly before selecting views.

#### Acceptance Criteria

1. WHEN the Model is loaded, THE Browser Client SHALL render an interactive Three.js viewport displaying the Model.
2. THE Browser Client SHALL render the initial view of the Model using the Isometric Preset View upon first load.
3. WHEN the user selects a Preset View from the view selector, THE Browser Client SHALL update the Three.js viewport to display the Model from that Preset View within 500 ms.
4. THE Browser Client SHALL display the name of the currently active Preset View in the viewport.
5. WHILE the Model is displayed, THE Browser Client SHALL maintain a minimum rendered frame rate of 30 fps on a desktop browser.

---

### Requirement 3: Preset View Selection

**User Story:** As a user, I want to choose from standard architectural views, so that I can select the exact angles I need in my PDF without manual camera configuration.

#### Acceptance Criteria

1. THE Browser Client SHALL present all seven Preset Views — Top, Bottom, Front, Back, Left, Right, and Isometric — as selectable options in a view selection panel.
2. WHEN the user activates a Preset View option, THE Browser Client SHALL mark that view as a Selected View and visually distinguish it from unselected views.
3. WHEN the user deactivates a previously activated Preset View option, THE Browser Client SHALL remove that view from the Selected Views.
4. THE Browser Client SHALL allow the user to select any number of Preset Views from one to seven simultaneously.
5. THE Browser Client SHALL display the count of currently Selected Views in the interface.

---

### Requirement 4: View Preview per Selected Angle

**User Story:** As a user, I want to see a thumbnail preview for each selected view, so that I can confirm the composition of each page before exporting.

#### Acceptance Criteria

1. WHEN a Preset View is added to the Selected Views, THE Browser Client SHALL generate and display a thumbnail preview image for that view.
2. THE Browser Client SHALL update the thumbnail preview for a Selected View whenever the Model changes.
3. THE Browser Client SHALL display all Selected View thumbnails in a preview panel ordered consistently with the intended PDF page order.
4. WHEN a Preset View is removed from the Selected Views, THE Browser Client SHALL remove its corresponding thumbnail from the preview panel.

---

### Requirement 5: PDF Page Annotation

**User Story:** As a user, I want to optionally add a title and scale label to each PDF page, so that the exported document is suitable for architectural documentation.

#### Acceptance Criteria

1. THE Browser Client SHALL provide a toggle that enables or disables Annotation for all PDF Pages.
2. WHERE Annotation is enabled, THE Browser Client SHALL include a view title on each PDF Page, defaulting to the Preset View name (e.g., "Front", "Isometric").
3. WHERE Annotation is enabled, THE Browser Client SHALL allow the user to enter a custom title for each PDF Page individually, overriding the default view name.
4. WHERE Annotation is enabled, THE Browser Client SHALL provide an optional text field for a scale label (e.g., "1:100") on each PDF Page.
5. WHERE Annotation is enabled and a scale label is provided, THE Browser Client SHALL include the scale label on the corresponding PDF Page.
6. WHERE Annotation is disabled, THE Browser Client SHALL omit all annotation text from every PDF Page.

---

### Requirement 6: High-Resolution Render and Export Initiation

**User Story:** As a user, I want to export my selected views to a PDF with high-quality rendering, so that the output is suitable for printing and professional documentation.

#### Acceptance Criteria

1. WHEN the user initiates an Export, THE Browser Client SHALL render each Selected View at a minimum resolution of 2480 × 3508 pixels (A4 at 300 dpi).
2. WHEN the user initiates an Export with no Selected Views, THE Browser Client SHALL display a validation message instructing the user to select at least one view, and SHALL NOT proceed with the Export.
3. WHEN all Selected Views have been rendered at high resolution, THE Browser Client SHALL assemble the Render Payload and transmit it to the PDF Service via an HTTP POST request.
4. WHILE the Export is in progress, THE Browser Client SHALL display a progress indicator and disable the Export control to prevent duplicate submissions.
5. IF the HTTP request to the PDF Service fails or returns a non-200 status code, THEN THE Browser Client SHALL display an error message and re-enable the Export control.

---

### Requirement 7: PDF Generation

**User Story:** As a user, I want the backend to produce a well-formed PDF, so that I receive a ready-to-use document without additional post-processing.

#### Acceptance Criteria

1. WHEN the PDF Service receives a valid Render Payload, THE PDF Service SHALL generate a PDF document containing one PDF Page per Selected View in the order provided by the Render Payload.
2. THE PDF Service SHALL produce each PDF Page at A4 paper size (210 mm × 297 mm).
3. WHEN Annotation data is present in the Render Payload for a given view, THE PDF Service SHALL render the view title and scale label on the corresponding PDF Page.
4. THE PDF Service SHALL return the generated PDF document as a binary response with the `Content-Type` header set to `application/pdf`.
5. WHEN the Render Payload contains an invalid or missing required field, THE PDF Service SHALL return an HTTP 400 response with a JSON body describing the validation error.
6. THE PDF Service SHALL complete PDF generation and return the response within 30 seconds of receiving the Render Payload for up to 7 views.

---

### Requirement 8: PDF Download

**User Story:** As a user, I want the generated PDF to be automatically downloaded to my machine, so that I can immediately use the file without navigating away.

#### Acceptance Criteria

1. WHEN the Browser Client receives a successful PDF response from the PDF Service, THE Browser Client SHALL trigger an automatic file download in the browser.
2. THE Browser Client SHALL name the downloaded file using the pattern `<original-skp-filename>-views.pdf` where `<original-skp-filename>` is the base name of the uploaded SKP File without its extension.
3. WHEN the download is initiated, THE Browser Client SHALL hide the progress indicator and re-enable the Export control.

---

### Requirement 9: Responsive and Accessible Interface

**User Story:** As a user, I want the application to be usable across common desktop screen sizes and accessible with a keyboard, so that I can work comfortably in different environments.

#### Acceptance Criteria

1. THE Browser Client SHALL render correctly at viewport widths from 1024 px to 2560 px without horizontal scrolling.
2. THE Browser Client SHALL provide keyboard navigation for all interactive controls, including the file upload control, Preset View options, annotation fields, and the Export control.
3. THE Browser Client SHALL provide visible focus indicators on all interactive controls when navigating by keyboard.
4. THE Browser Client SHALL associate all form inputs with descriptive labels that are exposed to assistive technologies.
