import { getDeployStore, getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";

type NetlifyRuntime = {
  env: {
    get(name: string): string | undefined;
  };
  context?: {
    deploy?: {
      context?: string;
    };
  };
};

const contentTypes: Record<string, string> = {
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  mov: "video/quicktime",
  mp4: "video/mp4",
  png: "image/png",
  svg: "image/svg+xml",
  webm: "video/webm",
  webp: "image/webp",
};

interface StoredMedia {
  contentType: string;
  data: string;
}

interface UploadPayload {
  contentType?: string;
  data?: string;
  mediaType?: "image" | "video";
  name?: string;
}

function netlifyRuntime() {
  return (globalThis as typeof globalThis & { Netlify?: NetlifyRuntime }).Netlify;
}

function getEnv(name: string) {
  return netlifyRuntime()?.env.get(name) || "";
}

function getBlobStore() {
  const deployContext = netlifyRuntime()?.context?.deploy?.context;

  if (deployContext === "production") {
    return getStore("adehasc-media", { consistency: "strong" });
  }

  return getDeployStore("adehasc-media");
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}

function authorize(req: Request) {
  const configuredPassword = getEnv("ADMIN_PASSWORD");

  if (!configuredPassword) {
    return json(
      {
        error:
          "ADMIN_PASSWORD ainda não foi configurada no Netlify. Defina a variável de ambiente para ativar uploads.",
      },
      503,
    );
  }

  if (req.headers.get("x-admin-password") !== configuredPassword) {
    return json({ error: "Senha ADM inválida." }, 401);
  }

  return null;
}

function safeFileName(value: string) {
  const decoded = decodeURIComponent(value || "midia");
  const clean = decoded
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return clean || "midia";
}

function contentTypeFor(key: string) {
  const parts = key.split(".");
  const extension = parts[parts.length - 1]?.toLowerCase() || "";
  return contentTypes[extension] || "application/octet-stream";
}

export default async (req: Request, _context: Context) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const marker = "/api/media/";
    const key = decodeURIComponent(
      url.pathname.includes(marker) ? url.pathname.slice(url.pathname.indexOf(marker) + marker.length) : "",
    );

    if (!key) {
      return json({ error: "Mídia não encontrada." }, 404);
    }

    const stored = (await getBlobStore().get(key, { type: "json" })) as StoredMedia | null;

    if (!stored?.data) {
      return json({ error: "Mídia não encontrada." }, 404);
    }

    const data = Buffer.from(stored.data, "base64");

    return new Response(data, {
      headers: {
        "cache-control": "public, max-age=31536000, immutable",
        "content-type": stored.contentType || contentTypeFor(key),
      },
    });
  }

  if (req.method === "POST") {
    const authError = authorize(req);
    if (authError) {
      return authError;
    }

    const payload = (await req.json().catch(() => null)) as UploadPayload | null;
    const cleanData = payload?.data?.includes(",")
      ? payload.data.split(",").pop() || ""
      : payload?.data || "";
    const fileName = safeFileName(payload?.name || "midia");
    const mediaType = payload?.mediaType === "video" ? "video" : "image";
    const contentType = payload?.contentType || contentTypeFor(fileName);
    const key = `${Date.now()}-${crypto.randomUUID()}-${fileName}`;

    if (!cleanData) {
      return json({ error: "Arquivo vazio." }, 400);
    }

    await getBlobStore().setJSON(key, {
      contentType,
      data: cleanData,
    });

    return json(
      {
        media: {
          id: crypto.randomUUID(),
          type: mediaType,
          src: `/api/media/${encodeURIComponent(key)}`,
          name: fileName,
        },
      },
      201,
    );
  }

  return json({ error: "Método não permitido." }, 405);
};

export const config: Config = {
  path: ["/api/media", "/api/media/:key"],
};
