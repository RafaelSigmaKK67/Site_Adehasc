import { randomUUID } from "node:crypto";
import { authorizeAdmin } from "./_auth";
import { getHeader, getQueryValue, readJsonBody, sendJson, type ApiRequest, type ApiResponse } from "./_http";
import { loadPosts, writePosts } from "./_posts-store";
import type { MediaItem, MediaType, Post, PostStatus } from "../src/types";

type PostPayload = Partial<Post> & {
  media?: unknown;
};

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

function normalizePost(input: PostPayload, existing?: Post): Post {
  const now = new Date().toISOString();
  const status: PostStatus = input.status === "draft" ? "draft" : "published";

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

