import type { MediaItem, Post, PostInput } from "./types";

const jsonHeaders = {
  "Content-Type": "application/json",
};

const maxImageUploadBytes = 8 * 1024 * 1024;
const maxVideoUploadBytes = 4 * 1024 * 1024;

export const uploadGuidance =
  "Upload direto aceita fotos até 8 MB e vídeos pequenos até 4 MB. Para vídeos maiores, publique no YouTube/Vimeo/Drive e cole a URL pública.";

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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function isVideoFile(file: File) {
  return file.type.startsWith("video") || /\.(mp4|webm|mov|m4v)$/i.test(file.name);
}

function formatSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".0", "")} MB`;
}

export async function uploadMedia(file: File, adminPassword: string): Promise<MediaItem> {
  const isVideo = isVideoFile(file);
  const limit = isVideo ? maxVideoUploadBytes : maxImageUploadBytes;

  if (file.size > limit) {
    throw new Error(
      isVideo
        ? `O vídeo "${file.name}" tem ${formatSize(file.size)}. O upload direto aceita vídeos até ${formatSize(limit)}. Para vídeos maiores, publique no YouTube, Vimeo ou Drive e cole a URL pública.`
        : `A imagem "${file.name}" tem ${formatSize(file.size)}. O limite para envio direto é ${formatSize(limit)}.`,
    );
  }

  const dataUrl = await fileToDataUrl(file);
  const encodedData = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;

  const response = await fetch("/api/media", {
    method: "POST",
    headers: {
      ...jsonHeaders,
      "x-admin-password": adminPassword,
    },
    body: JSON.stringify({
      contentType: file.type || "application/octet-stream",
      data: encodedData,
      mediaType: isVideo ? "video" : "image",
      name: file.name,
    }),
  });
  const result = await readResponse<{ media: MediaItem }>(response);
  return result.media;
}
