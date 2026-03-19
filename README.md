# free-tts Node.js Server

Minimal Node.js TTS server using `edge-tts-universal`.

API documentation for app integration:

- `API_DOCUMENTATION.md`

Render deployment:

- `render.yaml`

## Requirements

- Node.js 18 or newer
- npm

## Setup

```bash
npm install
```

## Local development

```bash
npm run dev
```

## Start server

```bash
npm start
```

## Routes

- `GET /health`
- `GET /warmup`
- `GET /tts?text=...&voice=vi-VN-HoaiMyNeural&rate=10&pitch=0`
- `GET /tts/stream?text=...&voice=vi-VN-HoaiMyNeural&rate=10&pitch=0`
- `GET /voices`

## Deploy To Render

1. Push the repository to GitHub
2. Open the Render Dashboard
3. Choose `New > Blueprint`
4. Select the `edge-free-tts` repository
5. Render will read `render.yaml` and create the web service

Render Blueprints use the `render.yaml` file from the repository root. For Node.js web services, this project uses `npm install` and `npm start`, and also exposes `/health` for health checks.
