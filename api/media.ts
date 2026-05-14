import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { authorizeAdmin } from "./_auth";
import { readJsonBody, sendJson, type ApiRequest, type ApiResponse } from "./_http";

const maxUploadBytes = 250 * 1024 * 1024;

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

  if (!authorizeAdmin(req, res, "uploads")) {
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

