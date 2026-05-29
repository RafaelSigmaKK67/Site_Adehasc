import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { get, put } from "@vercel/blob";
import type {
  ImageBackground,
  ImageFit,
  ImageLayout,
  MediaItem,
  MediaType,
  Post,
  PostStatus,
} from "../src/types";

const validImageLayouts: ImageLayout[] = ["single", "grid", "carousel", "featured", "gallery"];
const validImageFits: ImageFit[] = ["contain", "cover"];
const validImageBackgrounds: ImageBackground[] = ["white", "blur", "neutral"];

type PostPayload = Partial<Post> & {
  media?: unknown;
};

type ApiRequest = IncomingMessage & {
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
};

type ApiResponse = ServerResponse;

const postsKey = "adehasc/posts.json";

const seedPosts: Post[] = [
  {
    id: "boas-vindas",
    title: "ADEHASC amplia o acesso à informação habitacional",
    category: "Institucional",
    excerpt:
      "Um espaço digital para publicar matérias, fotos e vídeos sobre desenvolvimento habitacional sustentável em Santa Catarina.",
    body:
      "Este portal foi preparado para receber notícias, comunicados, galerias de fotos e vídeos da ADEHASC. Visitantes podem acompanhar todas as matérias publicadas, enquanto a administração gerencia o conteúdo pelo painel ADM.",
    cover: "/adehasc-logo.png",
    status: "published",
    featured: true,
    media: [],
    createdAt: "2026-05-04T12:00:00.000Z",
    updatedAt: "2026-05-04T12:00:00.000Z",
  },
];

function getHeader(req: ApiRequest, name: string) {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] || "" : value || "";
}

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
      error: "ADMIN_PASSWORD ainda não foi configurada no Vercel. Defina a variável de ambiente para ativar o painel ADM.",
    });
    return false;
  }

  if (getHeader(req, "x-admin-password") !== configuredPassword) {
    sendJson(res, 401, { error: "Senha ADM inválida." });
    return false;
  }

  return true;
}

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function loadPosts() {
  if (!hasBlobToken()) {
    return seedPosts;
  }

  try {
    const stored = await get(postsKey, { access: "private", useCache: false });

    if (!stored || stored.statusCode !== 200 || !stored.stream) {
      return seedPosts;
    }

    const text = await new Response(stored.stream).text();
    const posts = JSON.parse(text);
    return Array.isArray(posts) ? (posts as Post[]) : seedPosts;
  } catch (error) {
    console.error("Nao foi possivel carregar posts no Vercel Blob.", error);
    return seedPosts;
  }
}

async function writePosts(posts: Post[]) {
  if (!hasBlobToken()) {
    const error = new Error(
      "BLOB_READ_WRITE_TOKEN ainda não foi configurada no Vercel. Conecte um Blob Store ao projeto para salvar matérias.",
    );
    throw Object.assign(error, { statusCode: 503 });
  }

  await put(postsKey, JSON.stringify(posts, null, 2), {
    access: "private",
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: "application/json",
  });
}

function cleanString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeMedia(media: unknown): MediaItem[] {
  if (!Array.isArray(media)) {
    return [];
  }

  return media
    .map((item): MediaItem => {
      const type: MediaType = item?.type === "video" ? "video" : "image";

      return {
        id: cleanString(item?.id) || randomUUID(),
        type,
        src: cleanString(item?.src),
        name: cleanString(item?.name, "Mídia"),
        caption: cleanString(item?.caption),
      };
    })
    .filter((item) => item.src);
}

function pickEnum<T extends string>(value: unknown, allowed: T[], fallback?: T): T | undefined {
  if (typeof value === "string" && (allowed as string[]).includes(value)) {
    return value as T;
  }
  return fallback;
}

function normalizePost(input: PostPayload, existing?: Post): Post {
  const now = new Date().toISOString();
  const status: PostStatus = input.status === "draft" ? "draft" : "published";

  const imageLayout = pickEnum<ImageLayout>(input.imageLayout, validImageLayouts, existing?.imageLayout);
  const imageFit = pickEnum<ImageFit>(input.imageFit, validImageFits, existing?.imageFit);
  const imageBackground = pickEnum<ImageBackground>(
    input.imageBackground,
    validImageBackgrounds,
    existing?.imageBackground,
  );

  return {
    id: existing?.id || cleanString(input.id) || randomUUID(),
    title: cleanString(input.title, existing?.title || "Matéria sem título"),
    category: cleanString(input.category, existing?.category || "Notícias"),
    excerpt: cleanString(input.excerpt, existing?.excerpt || ""),
    body: cleanString(input.body, existing?.body || ""),
    cover: cleanString(input.cover, existing?.cover || ""),
    status,
    featured: Boolean(input.featured),
    media: normalizeMedia(input.media),
    ...(imageLayout ? { imageLayout } : {}),
    ...(imageFit ? { imageFit } : {}),
    ...(imageBackground ? { imageBackground } : {}),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

function sendError(res: ApiResponse, error: unknown) {
  const statusCode =
    typeof error === "object" && error && "statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : 500;
  const message = error instanceof Error ? error.message : "Não foi possível concluir a operação.";
  sendJson(res, statusCode, { error: message });
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    if (req.method === "GET") {
      const adminHeader = getHeader(req, "x-admin-password");

      if (adminHeader && !authorizeAdmin(req, res)) {
        return;
      }

      const posts = await loadPosts();
      sendJson(res, 200, {
        posts: adminHeader ? posts : posts.filter((post) => post.status === "published"),
      });
      return;
    }

    if (!authorizeAdmin(req, res)) {
      return;
    }

    if (req.method === "POST") {
      const input = await readJsonBody<PostPayload>(req);
      const posts = await loadPosts();
      const post = normalizePost(input);
      await writePosts([post, ...posts]);
      sendJson(res, 201, { post });
      return;
    }

    if (req.method === "PUT") {
      const input = await readJsonBody<PostPayload>(req);
      const posts = await loadPosts();
      const index = posts.findIndex((post) => post.id === input.id);

      if (index === -1) {
        sendJson(res, 404, { error: "Matéria não encontrada." });
        return;
      }

      const post = normalizePost(input, posts[index]);
      posts[index] = post;
      await writePosts(posts);
      sendJson(res, 200, { post });
      return;
    }

    if (req.method === "DELETE") {
      const id = getQueryValue(req, "id");

      if (!id) {
        sendJson(res, 400, { error: "Informe o id da matéria." });
        return;
      }

      const posts = await loadPosts();
      await writePosts(posts.filter((post) => post.id !== id));
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 405, { error: "Método não permitido." });
  } catch (error) {
    sendError(res, error);
  }
}
