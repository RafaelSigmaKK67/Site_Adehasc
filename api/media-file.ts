import { get } from "@vercel/blob";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";

type ApiRequest = IncomingMessage & {
  query?: Record<string, string | string[] | undefined>;
};

type ApiResponse = ServerResponse;

function getQueryValue(req: ApiRequest, key: string) {
  const queryValue = req.query?.[key];

  if (Array.isArray(queryValue)) {
    return queryValue[0] || "";
  }

  if (queryValue) {
    return queryValue;
  }

  const url = new URL(req.url || "", "http://localhost");
  return url.searchParams.get(key) || "";
}

function sendJson(res: ApiResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(data));
}

function isAllowedMediaPath(pathname: string) {
  const cleanPathname = pathname.replace(/\\/g, "/");
  return cleanPathname.startsWith("media/") && !cleanPathname.includes("..");
}

function setHeaderIfPresent(
  res: ApiResponse,
  headers: { get(name: string): string | null },
  name: string,
) {
  const value = headers.get(name);

  if (value) {
    res.setHeader(name, value);
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, { error: "Método não permitido." });
    return;
  }

  const pathname = getQueryValue(req, "path");

  if (!pathname || !isAllowedMediaPath(pathname)) {
    sendJson(res, 400, { error: "Mídia inválida." });
    return;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    sendJson(res, 503, {
      error:
        "BLOB_READ_WRITE_TOKEN ainda não foi configurada no Vercel. Conecte um Blob Store ao projeto para exibir mídias.",
    });
    return;
  }

  const range = req.headers.range;
  const result = await get(pathname, {
    access: "private",
    headers: typeof range === "string" ? { range } : undefined,
    useCache: true,
  });

  if (!result || !result.stream) {
    sendJson(res, 404, { error: "Mídia não encontrada." });
    return;
  }

  setHeaderIfPresent(res, result.headers, "content-type");
  setHeaderIfPresent(res, result.headers, "content-length");
  setHeaderIfPresent(res, result.headers, "content-range");
  setHeaderIfPresent(res, result.headers, "etag");
  res.setHeader("accept-ranges", "bytes");
  res.setHeader("cache-control", "public, max-age=31536000, immutable");
  res.statusCode = result.headers.get("content-range") ? 206 : 200;

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  Readable.fromWeb(result.stream as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
}
