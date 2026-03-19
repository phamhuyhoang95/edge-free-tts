# free-tts API Documentation

Tai lieu nay mo ta API hien tai de app Flutter co the tich hop nhanh.

Base URL local:

```text
http://127.0.0.1:8787
```

Neu deploy len server thi thay base URL bang domain thuc te cua ban.

## Tong quan

API co 3 endpoint:

- `GET /tts`: tra ve file MP3 hoan chinh
- `GET /tts/stream`: stream MP3 de app co the phat som
- `GET /voices`: tra ve danh sach giong `vi-VN`

Tat ca endpoint deu ho tro CORS.

## 1. GET /voices

Lay danh sach giong tieng Viet.

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

## 2. GET /tts

Tra ve file MP3 hoan chinh. Phu hop khi ban muon:

- tai file ve
- luu cache trong app
- cho audio player doc tu URL file hoan chinh

### Query params

- `text`: noi dung can doc, bat buoc, toi da `3000` ky tu
- `voice`: ten giong doc, mac dinh `vi-VN-HoaiMyNeural`
- `rate`: so nguyen tu `-100` den `100`, mac dinh `0`
- `pitch`: so nguyen tu `-100` den `100`, mac dinh `0`

### Example request

```text
GET /tts?text=Xin%20chao&voice=vi-VN-HoaiMyNeural&rate=20&pitch=-2
```

### Response 200

- `Content-Type: audio/mpeg`
- body la du lieu MP3

### Response 400

```json
{
  "error": "Missing text"
}
```

Hoac:

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

### Flutter example: tao URL de player dung truc tiep

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

### Flutter example: tai file MP3

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

## 3. GET /tts/stream

Stream audio MP3. Phu hop khi ban muon:

- bat dau phat som
- doc truyen
- voice chat / tro ly ao

### Query params

Giong `GET /tts`.

- `text`: bat buoc
- `voice`: mac dinh `vi-VN-HoaiMyNeural`
- `rate`: `-100` den `100`
- `pitch`: `-100` den `100`

### Example request

```text
GET /tts/stream?text=Xin%20chao&voice=vi-VN-HoaiMyNeural&rate=20&pitch=-2
```

### Response 200

- `Content-Type: audio/mpeg`
- body la MP3 stream

### Lua chon cho Flutter

Neu audio player cua ban ho tro phat tu URL HTTP stream, hay uu tien dung `/tts/stream`.

Neu player cua ban khong phat on dinh voi stream MP3, hay dung `/tts`.

## Flutter integration guide

## Option A: dung URL truc tiep cho player

Neu ban dung package nhu `just_audio`, ban co the dua URL thang cho player:

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

Dung `/tts` neu ban muon cho audio file hoan chinh:

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

## Option B: goi API truoc, sau do xu ly response

Dung cach nay khi ban muon:

- kiem tra loi HTTP chi tiet
- luu file
- cache trong app

## Validation rules

- `text` khong duoc rong
- `text` toi da `3000` ky tu
- `rate` phai la so nguyen trong khoang `-100` den `100`
- `pitch` phai la so nguyen trong khoang `-100` den `100`

## Recommended settings for Vietnamese story reading

Presets goi y:

- Binh thuong, ro chu: `voice=vi-VN-HoaiMyNeural`, `rate=15`, `pitch=0`
- Nhanh ma van ro: `voice=vi-VN-HoaiMyNeural`, `rate=20`, `pitch=0`
- Sieu nhanh nhung van nghe duoc: `voice=vi-VN-HoaiMyNeural`, `rate=28`, `pitch=-2`

## Suggested app defaults

- Default voice: `vi-VN-HoaiMyNeural`
- Fallback voice: `vi-VN-NamMinhNeural`
- Default endpoint cho app nghe truc tiep: `/tts/stream`
- Fallback endpoint khi stream player khong on dinh: `/tts`

## Error handling recommendation in Flutter

- Neu `/tts/stream` loi hoac player khong phat duoc, fallback sang `/tts`
- Neu server tra `400`, hien loi input cho user
- Neu server tra `502`, thu lai sau

## Suggested fallback flow

1. Goi `/tts/stream`
2. Neu player fail hoac request fail, chuyen sang `/tts`
3. Neu van fail, hien thong bao loi va cho user thu lai

## Quick test URLs

```text
http://127.0.0.1:8787/voices
http://127.0.0.1:8787/tts?text=Xin%20chao&voice=vi-VN-HoaiMyNeural&rate=20&pitch=-2
http://127.0.0.1:8787/tts/stream?text=Xin%20chao&voice=vi-VN-HoaiMyNeural&rate=20&pitch=-2
```
