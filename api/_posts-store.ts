import { get, put } from "@vercel/blob";
import type { Post } from "../src/types";

const postsKey = "adehasc/posts.json";

export const seedPosts: Post[] = [
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

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function loadPosts() {
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

export async function writePosts(posts: Post[]) {
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

