# SketchUp to PDF Converter

![Version](https://img.shields.io/badge/version-v0.9.0-blue)
![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20TypeScript-61dafb)
![Backend](https://img.shields.io/badge/backend-FastAPI-009688)
![License](https://img.shields.io/badge/license-MIT-green)

A web application for previewing SketchUp (`.skp`) models and exporting selected views into PDF documents.

> Current release: **v0.9.0**

## Features

- Upload and preview SketchUp (`.skp`) files.
- Interactive 3D viewport powered by Three.js.
- Multiple camera viewpoints.
- Generate thumbnails for exported views.
- Export selected views into PDF.
- FastAPI backend for PDF generation.
- Automated frontend and backend tests.

## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- Three.js

### Backend

- FastAPI
- Uvicorn
- ReportLab
- Pydantic
- Pillow

## Project Structure

```text
.
├── backend/
├── frontend/
├── .kiro/
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## Local Development

### Requirements

- Python 3.11+
- Node.js 20+
- npm

### Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend:

```text
http://127.0.0.1:5173
```

### Run the backend

```bash
python -m venv .venv
```

Windows:

```bash
.\.venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r backend/requirements.txt
```

Run the API:

```bash
python -m uvicorn backend.main:app --reload
```

Backend:

```text
http://127.0.0.1:8000
```

Health endpoint:

```text
http://127.0.0.1:8000/health
```

## Docker

```bash
docker compose up --build
```

## Testing

Backend:

```bash
cd backend
pytest
```

Frontend:

```bash
cd frontend
npm test
```

## Known Issues

- SketchUp materials and textures are not yet preserved correctly.
- Some models may render with gray materials.
- Viewport sizing occasionally needs refinement.

## Roadmap

### v1.0.0

- Improve viewport stability.
- Improve SketchUp material support.
- Simplify deployment.
- Optimize performance.

## License

Released under the MIT License.
