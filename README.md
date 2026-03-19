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
- `GET /tts?text=...&voice=vi-VN-HoaiMyNeural&rate=10&pitch=0`
- `GET /tts/stream?text=...&voice=vi-VN-HoaiMyNeural&rate=10&pitch=0`
- `GET /voices`

## Deploy To Render

1. Push repo len GitHub
2. Vao Render Dashboard
3. Chon `New > Blueprint`
4. Chon repo `edge-free-tts`
5. Render se doc file `render.yaml` va tao web service

Theo tai lieu Render, Blueprint dung file `render.yaml` o root repo va web service Node co the dung `npm install` / `npm start`. Render cung khuyen khai bao `healthCheckPath` cho web service.
