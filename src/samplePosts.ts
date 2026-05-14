import type { Post } from "./types";

export const samplePosts: Post[] = [
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
