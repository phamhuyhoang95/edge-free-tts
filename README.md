# free-tts Node.js Server

Minimal Node.js TTS server using `edge-tts-universal`.

API documentation for app integration:

- `API_DOCUMENTATION.md`

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

- `GET /tts?text=...&voice=vi-VN-HoaiMyNeural&rate=10&pitch=0`
- `GET /tts/stream?text=...&voice=vi-VN-HoaiMyNeural&rate=10&pitch=0`
- `GET /voices`
