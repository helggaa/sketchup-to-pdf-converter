# SketchUp to PDF Converter

![Version](https://img.shields.io/badge/version-v1.0.0-blue)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Three.js](https://img.shields.io/badge/Three.js-r168-black?logo=three.js)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite)
![License](https://img.shields.io/badge/License-MIT-green)

A browser-based application for previewing **SketchUp (.skp)** models and exporting multiple predefined views into a single PDF document.

Unlike traditional desktop workflows, the application runs entirely in the browser without requiring SketchUp, a backend server, or additional software.

---

## Live Demo

https://helggaa.github.io/sketchup-to-pdf-converter/

---

## Screenshots

### Upload SketchUp Model

![Upload page](docs/screenshots/upload-page.jpg)

### Interactive 3D Viewport

![3D viewport](docs/screenshots/viewport.jpg)


---

# Features

* Upload SketchUp (`.skp`) models directly from the browser.
* Parse modern SketchUp files using the **openskp** library.
* Interactive 3D preview powered by **Three.js**.
* Multiple predefined camera views:

  * Isometric
  * Front
  * Back
  * Left
  * Right
  * Top
  * Bottom
* Automatic thumbnail generation.
* Select multiple views for export.
* Export selected views into a single PDF.
* Annotation support for view titles.
* Browser-only architecture (no backend required).
* Responsive interface.
* Automated frontend unit tests.

---

# Tech Stack

## Frontend

* React
* TypeScript
* Vite
* Three.js
* pdf-lib
* openskp

## Development

* Vitest
* Testing Library
* Git
* GitHub

---

# Architecture

```text
                  +--------------------+
                  |  SketchUp (.skp)   |
                  +---------+----------+
                            |
                            |
                     openskp Parser
                            |
                            |
                    GLTF Conversion
                            |
                            |
                     Three.js Renderer
                            |
          +-----------------+------------------+
          |                                    |
          |                                    |
     3D Preview                         Thumbnail Generator
          |                                    |
          +-----------------+------------------+
                            |
                            |
                     PDF Generator
                       (pdf-lib)
                            |
                            |
                    Download PDF
```

---

# Project Structure

```text
.
├── .kiro/
│   └── specs/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── parsers/
│   │   ├── renderers/
│   │   ├── layouts/
│   │   ├── utils/
│   │   ├── test/
│   │   └── main.tsx
│   │
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── LICENSE
└── README.md
```

---

# Installation

## Requirements

* Node.js 20 or newer
* npm

---

## Clone Repository

```bash
git clone https://github.com/helggaa/sketchup-to-pdf-converter.git

cd sketchup-to-pdf-converter/frontend
```

---

## Install Dependencies

```bash
npm install
```

---

## Run Development Server

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

---

## Build Production

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

---

# Testing

Run all frontend tests:

```bash
npm test
```

---

# Supported Files

* SketchUp 2021+
* `.skp`

---

# Known Limitations

This project focuses on **technical PDF generation** rather than reproducing SketchUp's rendering engine.

Current limitations include:

* Material colors are preserved when possible but may differ from SketchUp's viewport.
* Texture maps are not fully supported.
* Complex SketchUp rendering effects are not reproduced.
* Legacy SketchUp files (pre-2021 OLE format) are not supported.
* Very large models (>100 MB) may require substantial browser memory and GPU resources.
* Color fidelity depends on the materials exported by the `openskp` conversion pipeline.

---

# Tested Models

The application has been tested with:

* Small residential models (~10 MB)
* Medium architectural models
* Large architectural models (~100 MB)

---

# Future Improvements

* Improve SketchUp material fidelity.
* Better support for textured materials.
* Batch export presets.
* Custom camera positioning.
* Custom PDF page templates.
* PDF scale and legend support.
* Measurement annotations.
* Better rendering performance for very large models.
* Drag-and-drop multiple file support.

---

# Why Browser-Only?

The project originally used a FastAPI backend for PDF generation.

The architecture was redesigned to perform:

* SketchUp parsing
* Three.js rendering
* PDF generation

entirely inside the browser.

Benefits:

* No backend server
* No Docker
* No deployment cost
* No API maintenance
* Easy deployment with GitHub Pages
* Better privacy because uploaded models never leave the user's browser

---

## Privacy

All processing happens locally in the browser:

- SketchUp files are not uploaded to any server.
- Rendering is performed with Three.js.
- PDF generation happens entirely on the client.
- No account or internet connection is required after the page loads.

---

# License

This project is licensed under the MIT License.

See the **LICENSE** file for details.

---

# Author

**Helga Parama Zhafran**

GitHub:
https://github.com/helggaa
