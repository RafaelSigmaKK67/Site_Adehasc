import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import type { IncomingMessage, ServerResponse } from "node:http";

type ApiRequest = IncomingMessage & {
  body?: unknown;
};

type ApiResponse = ServerResponse;

const maxUploadBytes = 250 * 1024 * 1024;

function getHeader(req: ApiRequest, name: string) {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function sendJson(res: ApiResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(data));
}

async function readJsonBody<T>(req: ApiRequest): Promise<T> {
  if (typeof req.body === "string") {
    return JSON.parse(req.body) as T;
  }

  if (Buffer.isBuffer(req.body)) {
    return JSON.parse(req.body.toString("utf8")) as T;
  }

  if (req.body && typeof req.body === "object") {
    return req.body as T;
  }

  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const text = Buffer.concat(chunks).toString("utf8");
  return (text ? JSON.parse(text) : {}) as T;
}

function authorizeAdmin(req: ApiRequest, res: ApiResponse) {
  const configuredPassword = process.env.ADMIN_PASSWORD || "";

  if (!configuredPassword) {
    sendJson(res, 503, {
      error: "ADMIN_PASSWORD ainda não foi configurada no Vercel. Defina a variável de ambiente para ativar uploads.",
    });
    return false;
  }

  if (getHeader(req, "x-admin-password") !== configuredPassword) {
    sendJson(res, 401, { error: "Senha ADM inválida." });
    return false;
  }

  return true;
}

function assertValidPathname(pathname: string) {
  const cleanPathname = pathname.replace(/\\/g, "/");

  if (!cleanPathname.startsWith("media/") || cleanPathname.includes("..")) {
    throw Object.assign(new Error("Caminho de upload inválido."), { statusCode: 400 });
  }
}

function sendError(res: ApiResponse, error: unknown) {
  const statusCode =
    typeof error === "object" && error && "statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : 500;
  const message = error instanceof Error ? error.message : "Não foi possível enviar a mídia.";
  sendJson(res, statusCode, { error: message });
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Método não permitido." });
    return;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    sendJson(res, 503, {
      error:
        "BLOB_READ_WRITE_TOKEN ainda não foi configurada no Vercel. Conecte um Blob Store ao projeto para enviar mídias.",
    });
    return;
  }

  if (!authorizeAdmin(req, res)) {
    return;
  }

  try {
    const body = await readJsonBody<HandleUploadBody>(req);
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        assertValidPathname(pathname);

        return {
          addRandomSuffix: false,
          allowedContentTypes: ["image/*", "video/*"],
          allowOverwrite: false,
          cacheControlMaxAge: 31536000,
          maximumSizeInBytes: maxUploadBytes,
        };
      },
    });

    sendJson(res, 200, result);
  } catch (error) {
    sendError(res, error);
  }
}
