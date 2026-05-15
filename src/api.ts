import { upload as uploadBlob } from "@vercel/blob/client";
import type { MediaItem, Post, PostInput } from "./types";

const jsonHeaders = {
  "Content-Type": "application/json",
};

const maxUploadBytes = 250 * 1024 * 1024;

export const uploadGuidance =
  "Upload direto usa Vercel Blob e aceita fotos e vídeos grandes. Para vídeos muito pesados, YouTube, Vimeo ou Drive continuam sendo boas opções.";

async function ensureMediaUploadsReady(adminPassword: string): Promise<void> {
  const response = await fetch("/api/media", {
    headers: {
      "x-admin-password": adminPassword,
    },
  });

  await readResponse<{ ok: true }>(response);
}

async function readResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : {};
  const text = contentType.includes("application/json")
    ? ""
    : await response.text().catch(() => "");

  if (!response.ok) {
    if (response.status === 413) {
      throw new Error(
        "Arquivo muito grande para upload direto. Para vídeo local grande, envie primeiro no YouTube, Vimeo ou Drive e cole a URL pública.",
      );
    }

    throw new Error(
      data.error ||
        text ||
        `Não foi possível concluir a operação. Código ${response.status}.`,
    );
  }

  return data as T;
}

export async function fetchPosts(adminPassword?: string): Promise<Post[]> {
  const response = await fetch("/api/posts", {
    headers: adminPassword ? { "x-admin-password": adminPassword } : undefined,
  });
  const data = await readResponse<{ posts: Post[] }>(response);
  return data.posts;
}

export async function savePost(post: PostInput, adminPassword: string): Promise<Post> {
  const response = await fetch("/api/posts", {
    method: post.id ? "PUT" : "POST",
    headers: {
      ...jsonHeaders,
      "x-admin-password": adminPassword,
    },
    body: JSON.stringify(post),
  });
  const data = await readResponse<{ post: Post }>(response);
  return data.post;
}

export async function deletePost(id: string, adminPassword: string): Promise<void> {
  const response = await fetch(`/api/posts?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: {
      "x-admin-password": adminPassword,
    },
  });
  await readResponse<{ ok: true }>(response);
}

function isVideoFile(file: File) {
  return file.type.startsWith("video") || /\.(mp4|webm|mov|m4v)$/i.test(file.name);
}

function formatSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".0", "")} MB`;
}

function safeFileName(value: string) {
  return (value || "midia")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function contentTypeFor(file: File) {
  if (file.type) {
    return file.type;
  }

  if (/\.(mp4|m4v)$/i.test(file.name)) {
    return "video/mp4";
  }

  if (/\.mov$/i.test(file.name)) {
    return "video/quicktime";
  }

  if (/\.webm$/i.test(file.name)) {
    return "video/webm";
  }

  return "application/octet-stream";
}

export async function uploadMedia(file: File, adminPassword: string): Promise<MediaItem> {
  const isVideo = isVideoFile(file);

  if (file.size > maxUploadBytes) {
    throw new Error(
      `O arquivo "${file.name}" tem ${formatSize(file.size)}. O limite para envio direto é ${formatSize(
        maxUploadBytes,
      )}. Para vídeos maiores, publique no YouTube, Vimeo ou Drive e cole a URL pública.`,
    );
  }

  await ensureMediaUploadsReady(adminPassword);

  const fileName = safeFileName(file.name) || "midia";
  const blob = await uploadBlob(`media/${Date.now()}-${crypto.randomUUID()}-${fileName}`, file, {
    access: "private",
    contentType: contentTypeFor(file),
    handleUploadUrl: "/api/media",
    headers: {
      "x-admin-password": adminPassword,
    },
    multipart: isVideo || file.size > 5 * 1024 * 1024,
  });

  return {
    id: crypto.randomUUID(),
    type: isVideo ? "video" : "image",
    src: `/api/media-file?path=${encodeURIComponent(blob.pathname)}`,
    name: file.name,
  };
}
