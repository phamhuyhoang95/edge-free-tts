import { createServer } from "node:http";
import {
  UniversalCommunicate,
  UniversalEdgeTTS,
  listVoicesUniversal,
} from "edge-tts-universal";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

function parseInteger(value: string): number | null {
  if (!/^-?\d+$/.test(value)) {
    return null;
  }

  return Number(value);
}

function validateRate(value: string | null): ValidationResult {
  if (value === null || value === "") {
    return { ok: true, value: "+0%" };
  }

  const numericValue = parseInteger(value);
  if (numericValue !== null) {
    if (numericValue < -100 || numericValue > 100) {
      return {
        ok: false,
        error: "Invalid rate range. Allowed range is -100 to 100.",
      };
    }

    return {
      ok: true,
      value: `${numericValue >= 0 ? "+" : ""}${numericValue}%`,
    };
  }

  if (!/^[+-]\d+%$/.test(value)) {
    return {
      ok: false,
      error: "Invalid rate. Use a number between -100 and 100.",
    };
  }

  const amount = Number(value.slice(0, -1));
  if (amount < -100 || amount > 100) {
    return {
      ok: false,
      error: "Invalid rate range. Allowed range is -100 to 100.",
    };
  }

  return { ok: true, value };
}

function validatePitch(value: string | null): ValidationResult {
  if (value === null || value === "") {
    return { ok: true, value: "+0Hz" };
  }

  const numericValue = parseInteger(value);
  if (numericValue !== null) {
    if (numericValue < -100 || numericValue > 100) {
      return {
        ok: false,
        error: "Invalid pitch range. Allowed range is -100 to 100.",
      };
    }

    return {
      ok: true,
      value: `${numericValue >= 0 ? "+" : ""}${numericValue}Hz`,
    };
  }

  if (/^[+-]?0%$/.test(value)) {
    return { ok: true, value: `${value.slice(0, -1)}Hz` };
  }

  if (!/^[+-]\d+Hz$/.test(value)) {
    return {
      ok: false,
      error: "Invalid pitch. Use a number between -100 and 100.",
    };
  }

  const amount = Number(value.slice(0, -2));
  if (amount < -100 || amount > 100) {
    return {
      ok: false,
      error: "Invalid pitch range. Allowed range is -100 to 100.",
    };
  }

  return { ok: true, value };
}

async function retry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let lastErr: unknown;

  for (let i = 0; i < retries; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      await sleep(300 * (i + 1));
    }
  }

  throw lastErr;
}

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : "Unknown error";

const errorType = (err: unknown) => {
  if (err && typeof err === "object" && "constructor" in err) {
    const constructor = (err as { constructor?: { name?: string } }).constructor;
    if (constructor?.name) {
      return constructor.name;
    }
  }

  return typeof err;
};

function setCorsHeaders(headers: Record<string, string>) {
  headers["access-control-allow-origin"] = "*";
  headers["access-control-allow-methods"] = "GET,OPTIONS";
  headers["access-control-allow-headers"] = "Content-Type";
}

function logRequestStart(requestId: string, method: string, url: URL) {
  const text = url.searchParams.get("text");
  const preview = text ? text.slice(0, 60).replace(/\s+/g, " ") : "";
  console.info(
    `[${requestId}] -> ${method} ${url.pathname} voice=${url.searchParams.get("voice") ?? ""} rate=${url.searchParams.get("rate") ?? ""} pitch=${url.searchParams.get("pitch") ?? ""} textLength=${text?.length ?? 0} textPreview="${preview}"`,
  );
}

function logRequestEnd(
  requestId: string,
  method: string,
  url: URL,
  status: number,
  startedAt: number,
) {
  console.info(
    `[${requestId}] <- ${method} ${url.pathname} ${status} ${Date.now() - startedAt}ms`,
  );
}

function logRequestError(
  requestId: string,
  method: string,
  url: URL,
  status: number,
  startedAt: number,
  err: unknown,
) {
  console.error(
    `[${requestId}] !! ${method} ${url.pathname} ${status} ${Date.now() - startedAt}ms ${errorType(err)}: ${errorMessage(err)}`,
  );
}

function logStreamProgress(
  requestId: string,
  method: string,
  url: URL,
  message: string,
  startedAt: number,
) {
  console.info(
    `[${requestId}] ~~ ${method} ${url.pathname} ${message} ${Date.now() - startedAt}ms`,
  );
}

function writeJson(
  response: import("node:http").ServerResponse,
  status: number,
  body: unknown,
) {
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
  };
  setCorsHeaders(headers);
  response.writeHead(status, headers);
  response.end(JSON.stringify(body));
}

function writeEmpty(response: import("node:http").ServerResponse, status: number) {
  const headers: Record<string, string> = {};
  setCorsHeaders(headers);
  response.writeHead(status, headers);
  response.end();
}

type TtsParams =
  | {
      ok: true;
      text: string;
      voice: string;
      rate: string;
      pitch: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

function getTtsParams(url: URL): TtsParams {
  const text = url.searchParams.get("text") ?? "";
  const voice = url.searchParams.get("voice") ?? "vi-VN-HoaiMyNeural";
  const rate = validateRate(url.searchParams.get("rate"));
  const pitch = validatePitch(url.searchParams.get("pitch"));

  if (!text) {
    return { ok: false, status: 400, error: "Missing text" };
  }

  if (text.length > 3000) {
    return { ok: false, status: 400, error: "Text too long (max 3000 chars)" };
  }

  if (!rate.ok) {
    return { ok: false, status: 400, error: rate.error };
  }

  if (!pitch.ok) {
    return { ok: false, status: 400, error: pitch.error };
  }

  return {
    ok: true,
    text,
    voice,
    rate: rate.value,
    pitch: pitch.value,
  };
}

async function getFirstAudioChunk(
  generator: AsyncGenerator<{
    type: "audio" | "WordBoundary" | "SentenceBoundary";
    data?: Uint8Array;
  }>,
): Promise<Uint8Array | null> {
  while (true) {
    const result = await generator.next();
    if (result.done) {
      return null;
    }

    const chunk = result.value;
    if (chunk.type === "audio" && chunk.data) {
      return chunk.data;
    }
  }
}

const port = Number(process.env.PORT ?? "8787");

const server = createServer(async (request, response) => {
  const startedAt = Date.now();
  const requestId = `${startedAt}-${Math.random().toString(36).slice(2, 8)}`;

  if (!request.url) {
    console.warn(`[${requestId}] !! UNKNOWN 400 missing request URL`);
    writeJson(response, 400, { error: "Missing request URL" });
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host ?? `localhost:${port}`}`);
  logRequestStart(requestId, request.method ?? "UNKNOWN", url);

  if (request.method === "OPTIONS") {
    writeEmpty(response, 204);
    logRequestEnd(requestId, "OPTIONS", url, 204, startedAt);
    return;
  }

  if (request.method !== "GET") {
    writeJson(response, 405, { error: "Method Not Allowed" });
    logRequestEnd(requestId, request.method ?? "UNKNOWN", url, 405, startedAt);
    return;
  }

  if (url.pathname === "/tts") {
    const params = getTtsParams(url);
    if (!params.ok) {
      writeJson(response, params.status, { error: params.error });
      logRequestEnd(requestId, request.method, url, params.status, startedAt);
      return;
    }

    try {
      const tts = new UniversalEdgeTTS(params.text, params.voice, {
        rate: params.rate,
        pitch: params.pitch,
      });
      const result = await retry(async () => tts.synthesize());
      const audioBuffer = Buffer.from(await result.audio.arrayBuffer());

      const headers: Record<string, string> = {
        "content-type": "audio/mpeg",
        "cache-control": "no-store",
      };
      setCorsHeaders(headers);
      response.writeHead(200, headers);
      response.end(audioBuffer);
      logRequestEnd(requestId, request.method, url, 200, startedAt);
      return;
    } catch (err) {
      logRequestError(requestId, request.method, url, 502, startedAt, err);
      writeJson(response, 502, {
        error: errorMessage(err),
        errorType: errorType(err),
      });
      return;
    }
  }

  if (url.pathname === "/tts/stream") {
    const params = getTtsParams(url);
    if (!params.ok) {
      writeJson(response, params.status, { error: params.error });
      logRequestEnd(requestId, request.method, url, params.status, startedAt);
      return;
    }

    try {
      const tts = new UniversalCommunicate(params.text, {
        voice: params.voice,
        rate: params.rate,
        pitch: params.pitch,
      });
      const generator = await retry(async () => tts.stream());
      const firstChunk = await getFirstAudioChunk(generator);

      if (!firstChunk) {
        throw new Error("No audio data received from TTS provider.");
      }

      const headers: Record<string, string> = {
        "content-type": "audio/mpeg",
        "cache-control": "no-store",
      };
      setCorsHeaders(headers);
      response.writeHead(200, headers);
      response.write(Buffer.from(firstChunk));
      let totalBytes = firstChunk.byteLength;
      let audioChunkCount = 1;
      logStreamProgress(
        requestId,
        request.method,
        url,
        `first-audio-chunk bytes=${firstChunk.byteLength}`,
        startedAt,
      );

      for await (const chunk of generator) {
        if (chunk.type === "audio" && chunk.data) {
          totalBytes += chunk.data.byteLength;
          audioChunkCount += 1;
          response.write(Buffer.from(chunk.data));
        }
      }

      response.end();
      logStreamProgress(
        requestId,
        request.method,
        url,
        `stream-complete chunks=${audioChunkCount} bytes=${totalBytes}`,
        startedAt,
      );
      logRequestEnd(requestId, request.method, url, 200, startedAt);
      return;
    } catch (err) {
      logRequestError(requestId, request.method, url, 502, startedAt, err);
      if (!response.headersSent) {
        writeJson(response, 502, {
          error: errorMessage(err),
          errorType: errorType(err),
        });
      } else {
        response.destroy(err instanceof Error ? err : undefined);
      }
      return;
    }
  }

  if (url.pathname === "/voices") {
    try {
      const voices = await listVoicesUniversal();
      const simple = voices.map((voice) => ({
        name: voice.ShortName,
        gender: voice.Gender,
        locale: voice.Locale,
      })).filter((voice) => voice.locale === "vi-VN");

      writeJson(response, 200, simple);
      logRequestEnd(requestId, request.method, url, 200, startedAt);
      return;
    } catch (err) {
      logRequestError(requestId, request.method, url, 500, startedAt, err);
      writeJson(response, 500, { error: errorMessage(err) });
      return;
    }
  }

  writeJson(response, 404, { error: "Not Found" });
  logRequestEnd(requestId, request.method, url, 404, startedAt);
});

server.listen(port, () => {
  console.log(`TTS server listening on http://localhost:${port}`);
});
