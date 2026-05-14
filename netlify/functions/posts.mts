import { getDeployStore, getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";

type MediaType = "image" | "video";
type PostStatus = "published" | "draft";

interface MediaItem {
  id: string;
  type: MediaType;
  src: string;
  name: string;
  caption?: string;
}

interface Post {
  id: string;
  title: string;
  category: string;
  excerpt: string;
  body: string;
  cover?: string;
  status: PostStatus;
  featured: boolean;
  media: MediaItem[];
  createdAt: string;
  updatedAt: string;
}

type PostInput = Partial<Post> & {
  media?: MediaItem[];
};

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

function netlifyRuntime() {
  return (globalThis as typeof globalThis & { Netlify?: NetlifyRuntime }).Netlify;
}

function getEnv(name: string) {
  return netlifyRuntime()?.env.get(name) || "";
}

function getBlobStore() {
  const deployContext = netlifyRuntime()?.context?.deploy?.context;

  if (deployContext === "production") {
    return getStore("adehasc-posts", { consistency: "strong" });
  }

  return getDeployStore("adehasc-posts");
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
          "ADMIN_PASSWORD ainda não foi configurada no Netlify. Defina a variável de ambiente para ativar o painel ADM.",
      },
      503,
    );
  }

  if (req.headers.get("x-admin-password") !== configuredPassword) {
    return json({ error: "Senha ADM inválida." }, 401);
  }

  return null;
}

async function loadPosts() {
  const store = getBlobStore();
  const posts = await store.get("posts.json", { type: "json" });

  if (!Array.isArray(posts)) {
    return seedPosts;
  }

  return posts as Post[];
}

async function writePosts(posts: Post[]) {
  await getBlobStore().setJSON("posts.json", posts);
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
        id: cleanString(item?.id) || crypto.randomUUID(),
        type,
        src: cleanString(item?.src),
      name: cleanString(item?.name, "Mídia"),
        caption: cleanString(item?.caption),
      };
    })
    .filter((item) => item.src);
}

function normalizePost(input: PostInput, existing?: Post): Post {
  const now = new Date().toISOString();
  const status: PostStatus = input.status === "draft" ? "draft" : "published";

  return {
    id: existing?.id || cleanString(input.id) || crypto.randomUUID(),
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

export default async (req: Request, _context: Context) => {
  if (req.method === "GET") {
    const adminHeader = req.headers.get("x-admin-password");

    if (adminHeader) {
      const authError = authorize(req);
      if (authError) {
        return authError;
      }
    }

    const posts = await loadPosts();
    return json({
      posts: adminHeader ? posts : posts.filter((post) => post.status === "published"),
    });
  }

  const authError = authorize(req);
  if (authError) {
    return authError;
  }

  if (req.method === "POST") {
    const input = (await req.json()) as PostInput;
    const posts = await loadPosts();
    const post = normalizePost(input);
    await writePosts([post, ...posts]);
    return json({ post }, 201);
  }

  if (req.method === "PUT") {
    const input = (await req.json()) as PostInput;
    const posts = await loadPosts();
    const index = posts.findIndex((post) => post.id === input.id);

    if (index === -1) {
      return json({ error: "Matéria não encontrada." }, 404);
    }

    const post = normalizePost(input, posts[index]);
    posts[index] = post;
    await writePosts(posts);
    return json({ post });
  }

  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return json({ error: "Informe o id da matéria." }, 400);
    }

    const posts = await loadPosts();
    await writePosts(posts.filter((post) => post.id !== id));
    return json({ ok: true });
  }

  return json({ error: "Método não permitido." }, 405);
};

export const config: Config = {
  path: "/api/posts",
};
