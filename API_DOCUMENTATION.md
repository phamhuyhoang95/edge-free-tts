# free-tts API Documentation

This document describes the current API for Flutter app integration.

Local base URL:

```text
http://127.0.0.1:8787
```

If you deploy this service, replace the base URL with your actual domain.

## Overview

The API currently exposes 4 endpoints:

- `GET /warmup`: wakes up the service, useful for Render free instances
- `GET /tts`: returns a complete MP3 file
- `GET /tts/stream`: streams MP3 audio so playback can begin earlier
- `GET /voices`: returns available Vietnamese voices only

All endpoints support CORS.

## 1. GET /warmup

Lightweight endpoint that the app can call before requesting TTS, especially when the service may be waking up from Render cold start.

### Request

```http
GET /warmup
```

### Response 200

```json
{
  "ok": true,
  "service": "edge-free-tts",
  "warmed": true,
  "timestamp": "2026-03-19T00:00:00.000Z"
}
```

### Flutter example

```dart
import 'package:http/http.dart' as http;

Future<void> warmupServer(String baseUrl) async {
  final response = await http
      .get(Uri.parse('$baseUrl/warmup'))
      .timeout(const Duration(seconds: 70));

  if (response.statusCode != 200) {
    throw Exception('Warmup failed: ${response.body}');
  }
}
```

## 2. GET /voices

Returns Vietnamese voices only.

### Request

```http
GET /voices
```

### Response 200

```json
[
  {
    "name": "vi-VN-HoaiMyNeural",
    "gender": "Female",
    "locale": "vi-VN"
  },
  {
    "name": "vi-VN-NamMinhNeural",
    "gender": "Male",
    "locale": "vi-VN"
  }
]
```

### Flutter example

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

Future<List<Map<String, dynamic>>> fetchVoices(String baseUrl) async {
  final response = await http.get(Uri.parse('$baseUrl/voices'));

  if (response.statusCode != 200) {
    throw Exception('Failed to load voices: ${response.body}');
  }

  final data = jsonDecode(response.body) as List<dynamic>;
  return data.cast<Map<String, dynamic>>();
}
```

## 3. GET /tts

Returns a complete MP3 file. This is useful when you want to:

- download the file
- cache audio in the app
- play from a fully generated audio file URL

### Query parameters

- `text`: required, maximum `3000` characters
- `voice`: voice name, default is `vi-VN-HoaiMyNeural`
- `rate`: integer from `-100` to `100`, default is `0`
- `pitch`: integer from `-100` to `100`, default is `0`

### Example request

```text
GET /tts?text=Hello&voice=vi-VN-HoaiMyNeural&rate=20&pitch=-2
```

### Response 200

- `Content-Type: audio/mpeg`
- body contains MP3 audio

### Response 400

```json
{
  "error": "Missing text"
}
```

Or:

```json
{
  "error": "Invalid rate range. Allowed range is -100 to 100."
}
```

### Response 502

```json
{
  "error": "...",
  "errorType": "..."
}
```

### Flutter example: build a direct player URL

```dart
Uri buildTtsUri({
  required String baseUrl,
  required String text,
  String voice = 'vi-VN-HoaiMyNeural',
  int rate = 0,
  int pitch = 0,
}) {
  return Uri.parse('$baseUrl/tts').replace(
    queryParameters: {
      'text': text,
      'voice': voice,
      'rate': '$rate',
      'pitch': '$pitch',
    },
  );
}
```

### Flutter example: download MP3 bytes

```dart
import 'dart:typed_data';
import 'package:http/http.dart' as http;

Future<Uint8List> downloadTts({
  required String baseUrl,
  required String text,
  String voice = 'vi-VN-HoaiMyNeural',
  int rate = 0,
  int pitch = 0,
}) async {
  final uri = Uri.parse('$baseUrl/tts').replace(
    queryParameters: {
      'text': text,
      'voice': voice,
      'rate': '$rate',
      'pitch': '$pitch',
    },
  );

  final response = await http.get(uri);

  if (response.statusCode != 200) {
    throw Exception('TTS failed: ${response.body}');
  }

  return response.bodyBytes;
}
```

## 4. GET /tts/stream

Streams MP3 audio. This is useful when you want to:

- start playback earlier
- read long-form content such as stories
- support voice chat or assistant-style UX

### Query parameters

Same parameters as `GET /tts`.

- `text`: required
- `voice`: default `vi-VN-HoaiMyNeural`
- `rate`: `-100` to `100`
- `pitch`: `-100` to `100`

### Example request

```text
GET /tts/stream?text=Hello&voice=vi-VN-HoaiMyNeural&rate=20&pitch=-2
```

### Response 200

- `Content-Type: audio/mpeg`
- body contains a streamed MP3 response

### Flutter guidance

If your audio player supports direct HTTP streaming playback, prefer `/tts/stream`.

If your player is more stable with fully generated files, use `/tts`.

## Flutter integration guide

## Option A: play directly from the URL

If you use a package such as `just_audio`, you can pass the endpoint URL directly to the player.

```dart
import 'package:just_audio/just_audio.dart';

final player = AudioPlayer();

Future<void> playStreamingTts({
  required String baseUrl,
  required String text,
  String voice = 'vi-VN-HoaiMyNeural',
  int rate = 20,
  int pitch = -2,
}) async {
  final uri = Uri.parse('$baseUrl/tts/stream').replace(
    queryParameters: {
      'text': text,
      'voice': voice,
      'rate': '$rate',
      'pitch': '$pitch',
    },
  );

  await player.setUrl(uri.toString());
  await player.play();
}
```

Use `/tts` when you want the fully generated file:

```dart
Future<void> playFullFileTts({
  required String baseUrl,
  required String text,
  String voice = 'vi-VN-HoaiMyNeural',
  int rate = 20,
  int pitch = -2,
}) async {
  final uri = Uri.parse('$baseUrl/tts').replace(
    queryParameters: {
      'text': text,
      'voice': voice,
      'rate': '$rate',
      'pitch': '$pitch',
    },
  );

  await player.setUrl(uri.toString());
  await player.play();
}
```

## Option B: call the API first and then process the response

Use this approach when you want to:

- inspect HTTP errors directly
- save the generated file
- cache audio in the app

## Validation rules

- `text` must not be empty
- `text` is limited to `3000` characters
- `rate` must be an integer between `-100` and `100`
- `pitch` must be an integer between `-100` and `100`

## Recommended settings for Vietnamese story reading

Suggested presets:

- Balanced and clear: `voice=vi-VN-HoaiMyNeural`, `rate=15`, `pitch=0`
- Fast while staying clear: `voice=vi-VN-HoaiMyNeural`, `rate=20`, `pitch=0`
- Very fast but still understandable: `voice=vi-VN-HoaiMyNeural`, `rate=28`, `pitch=-2`

## Suggested app defaults

- Default voice: `vi-VN-HoaiMyNeural`
- Fallback voice: `vi-VN-NamMinhNeural`
- Default playback endpoint: `/tts/stream`
- Fallback endpoint when streaming is unstable: `/tts`

## Error handling recommendation for Flutter

- Call `/warmup` first when the app has been idle for a while
- If `/tts/stream` fails or the player cannot play it, fall back to `/tts`
- If the server returns `400`, show an input validation error to the user
- If the server returns `502`, retry after a short delay

## Suggested fallback flow

1. Call `/warmup`
2. Call `/tts/stream`
3. If the player fails or the request fails, switch to `/tts`
4. If it still fails, show an error and allow retry

## Flutter warmup + play sample

```dart
import 'package:just_audio/just_audio.dart';
import 'package:http/http.dart' as http;

final player = AudioPlayer();

Future<void> warmupThenPlay({
  required String baseUrl,
  required String text,
  String voice = 'vi-VN-HoaiMyNeural',
  int rate = 20,
  int pitch = -2,
}) async {
  await http
      .get(Uri.parse('$baseUrl/warmup'))
      .timeout(const Duration(seconds: 70));

  final streamUri = Uri.parse('$baseUrl/tts/stream').replace(
    queryParameters: {
      'text': text,
      'voice': voice,
      'rate': '$rate',
      'pitch': '$pitch',
    },
  );

  try {
    await player.setUrl(streamUri.toString());
    await player.play();
  } catch (_) {
    final fileUri = Uri.parse('$baseUrl/tts').replace(
      queryParameters: {
        'text': text,
        'voice': voice,
        'rate': '$rate',
        'pitch': '$pitch',
      },
    );

    await player.setUrl(fileUri.toString());
    await player.play();
  }
}
```

## Quick test URLs

```text
http://127.0.0.1:8787/voices
http://127.0.0.1:8787/warmup
http://127.0.0.1:8787/tts?text=Hello&voice=vi-VN-HoaiMyNeural&rate=20&pitch=-2
http://127.0.0.1:8787/tts/stream?text=Hello&voice=vi-VN-HoaiMyNeural&rate=20&pitch=-2
```
