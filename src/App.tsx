import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardList,
  Ellipsis,
  Eye,
  EyeOff,
  FileCheck2,
  FileText,
  Globe,
  Handshake,
  HeartHandshake,
  Home,
  Landmark,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  Map,
  MapPin,
  MessageCircle,
  Newspaper,
  Phone,
  Pencil,
  Plus,
  RefreshCw,
  Route,
  Save,
  Search,
  Scale,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Users,
  Video,
  X,
} from "lucide-react";
import { type FormEvent, type ReactNode, type SyntheticEvent, useEffect, useMemo, useState } from "react";
import {
  deletePost,
  fetchPosts,
  savePost,
  uploadGuidance,
  uploadMedia,
} from "./api";
import { samplePosts } from "./samplePosts";
import type { MediaItem, Post, PostInput } from "./types";

const categories = ["Todas", "Institucional", "Notícias", "Projetos", "Eventos"];
const mediaFilters = ["Tudo", "Fotos", "Vídeos"];
const logoSrcSet = "/adehasc-logo.png 1x, /adehasc-logo@2x.png 2x";
const contactEmail = "admadehasc@gmail.com";
const contactPhoneDisplay = "(49) 3622-3137";
const contactPhoneHref = "tel:+554936223137";
// Confirmar com a equipe ADEHASC se este telefone também é o WhatsApp oficial.
const contactWhatsAppHref =
  "https://wa.me/554936223137?text=Ol%C3%A1%2C%20gostaria%20de%20atendimento%20sobre%20regulariza%C3%A7%C3%A3o%20fundi%C3%A1ria.";
const matrixLabel = "MATRIZ";
const matrixAddress = "Av. Salgado Filho, 559 - Centro, São Miguel do Oeste - SC, 89900-000";
const matrixMapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  "Av. Salgado Filho, 559 - Centro, São Miguel do Oeste, Santa Catarina",
)}`;
type PublicSection = "about" | "news" | "contact";

function createBlankPost(): PostInput {
  return {
    title: "",
    category: "Notícias",
    excerpt: "",
    body: "",
    cover: "",
    status: "draft",
    featured: false,
    media: [],
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function splitParagraphs(text: string) {
  return text
    .split(/\n{2,}|\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function handleImageError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;

  if (image.dataset.fallback === "true") {
    return;
  }

  image.dataset.fallback = "true";
  image.setAttribute("src", "/adehasc-logo.png");
  image.classList.add("fallback-image");
}

function getNormalizedUrl(input: string) {
  const iframeSrc = input.match(/src=["']([^"']+)["']/i)?.[1];
  const rawValue = (iframeSrc || input).trim();

  if (!rawValue) {
    return null;
  }

  const withProtocol = rawValue.startsWith("//")
    ? `https:${rawValue}`
    : /^[a-z][a-z0-9+.-]*:\/\//i.test(rawValue)
      ? rawValue
      : `https://${rawValue}`;

  try {
    const url = new URL(withProtocol);
    return ["http:", "https:"].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

function getYouTubeId(url: URL) {
  const segments = url.pathname.split("/").filter(Boolean);

  if (url.hostname.includes("youtu.be")) {
    return segments[0] || "";
  }

  if (url.searchParams.get("v")) {
    return url.searchParams.get("v") || "";
  }

  if (["shorts", "live", "embed", "v"].includes(segments[0])) {
    return segments[1] || "";
  }

  return "";
}

function getVideoEmbed(src: string) {
  const url = getNormalizedUrl(src);

  if (!url) {
    return src;
  }

  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
  const segments = url.pathname.split("/").filter(Boolean);

  if (host.includes("youtube.com") || host.includes("youtube-nocookie.com") || host.includes("youtu.be")) {
    const id = getYouTubeId(url);
    return id ? `https://www.youtube.com/embed/${id}` : url.toString();
  }

  if (host.includes("vimeo.com")) {
    const id = [...segments].reverse().find((segment) => /^\d+$/.test(segment));
    return id ? `https://player.vimeo.com/video/${id}` : url.toString();
  }

  if (host.includes("drive.google.com")) {
    const fileIndex = segments.indexOf("d");
    const id = fileIndex >= 0 ? segments[fileIndex + 1] : url.searchParams.get("id");
    return id ? `https://drive.google.com/file/d/${id}/preview` : url.toString();
  }

  if (host.includes("facebook.com") || host.includes("fb.watch")) {
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url.toString())}&show_text=false&width=900`;
  }

  if (host.includes("instagram.com") && ["p", "reel", "tv"].includes(segments[0])) {
    return `https://www.instagram.com/${segments[0]}/${segments[1]}/embed`;
  }

  if (host.includes("tiktok.com")) {
    const videoIndex = segments.indexOf("video");
    const videoId = videoIndex >= 0 ? segments[videoIndex + 1] : "";
    return videoId ? `https://www.tiktok.com/embed/v2/${videoId}` : url.toString();
  }

  return url.toString();
}

function isDirectVideoUrl(src: string) {
  const url = getNormalizedUrl(src);
  return Boolean(url && /\.(mp4|webm|mov|m4v)$/i.test(url.pathname));
}

function isEmbeddedVideo(src: string) {
  const url = getNormalizedUrl(src);

  if (!url) {
    return false;
  }

  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");

  return (
    host.includes("youtube.com") ||
    host.includes("youtube-nocookie.com") ||
    host.includes("youtu.be") ||
    host.includes("vimeo.com") ||
    host.includes("drive.google.com") ||
    host.includes("facebook.com") ||
    host.includes("fb.watch") ||
    host.includes("instagram.com") ||
    host.includes("tiktok.com")
  );
}

function isLocalFileReference(input: string) {
  const value = input.trim();

  return (
    /^file:\/\//i.test(value) ||
    /^[a-zA-Z]:[\\/]/.test(value) ||
    /^\\\\/.test(value) ||
    /^\/(Users|home|mnt|media)\//i.test(value)
  );
}

function normalizeVideoInput(input: string) {
  const url = getNormalizedUrl(input);

  if (!url) {
    return "";
  }

  const normalized = url.toString();
  return isEmbeddedVideo(normalized) || isDirectVideoUrl(normalized) ? normalized : "";
}

type PostVisual =
  | { kind: "image"; src: string; videoSrc?: string }
  | { kind: "video"; src: string; poster?: string }
  | { kind: "videoFallback"; src: string };

function getVideoThumbnail(src: string) {
  const url = getNormalizedUrl(src);

  if (!url) {
    return "";
  }

  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");

  if (host.includes("youtube.com") || host.includes("youtube-nocookie.com") || host.includes("youtu.be")) {
    const id = getYouTubeId(url);
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "";
  }

  return "";
}

function getVisualFromSource(src: string, videoSrc = ""): PostVisual {
  if (isDirectVideoUrl(src)) {
    return { kind: "video", src, poster: getVideoThumbnail(src) || undefined };
  }

  if (isEmbeddedVideo(src)) {
    const thumbnail = getVideoThumbnail(src);
    return thumbnail ? { kind: "image", src: thumbnail, videoSrc: videoSrc || src } : { kind: "videoFallback", src };
  }

  return { kind: "image", src, videoSrc };
}

function getPostVisual(post: Post): PostVisual {
  const cover = post.cover?.trim();

  if (cover) {
    return getVisualFromSource(cover);
  }

  const firstImage = post.media.find((item) => item.type === "image");

  if (firstImage) {
    return { kind: "image", src: firstImage.src };
  }

  const firstVideo = post.media.find((item) => item.type === "video");

  if (firstVideo) {
    return getVisualFromSource(firstVideo.src);
  }

  return { kind: "image", src: "/adehasc-logo.png" };
}

function createCoverLightboxItem(post: Post, visual: PostVisual): MediaItem {
  const isVideo = visual.kind === "video" || visual.kind === "videoFallback" || Boolean(visual.kind === "image" && visual.videoSrc);

  return {
    id: `${post.id}-cover`,
    type: isVideo ? "video" : "image",
    src: visual.kind === "image" ? visual.videoSrc || visual.src : visual.src,
    name: post.title,
  };
}

function PostImageFrame({
  alt,
  children,
  className = "",
  imageClassName = "",
  src,
}: {
  alt: string;
  children?: ReactNode;
  className?: string;
  imageClassName?: string;
  src: string;
}) {
  const frameClassName = ["post-image-frame", className].filter(Boolean).join(" ");
  const mainClassName = ["post-image-main", imageClassName].filter(Boolean).join(" ");

  return (
    <div className={frameClassName}>
      <img
        aria-hidden="true"
        alt=""
        className="post-image-bg"
        loading="lazy"
        onError={handleImageError}
        src={src}
      />
      <img
        alt={alt}
        className={mainClassName}
        loading="lazy"
        onError={handleImageError}
        src={src}
        srcSet={src === "/adehasc-logo.png" ? logoSrcSet : undefined}
      />
      {children}
    </div>
  );
}

function PostVisualFrame({ visual, variant }: { visual: PostVisual; variant: "card" | "detail" }) {
  const isDetail = variant === "detail";

  if (visual.kind === "image") {
    const imageClassName = [
      "post-visual-image",
      isDetail ? "article-cover post-cover news-detail-image" : "post-card-image news-card-image",
      visual.videoSrc ? "video-thumbnail-image" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <PostImageFrame
        alt=""
        className={isDetail ? "post-image-frame-detail" : "post-image-frame-card"}
        imageClassName={imageClassName}
        src={visual.src}
      >
        {visual.videoSrc && !isDetail ? (
          <span className="video-badge">
            <Video size={isDetail ? 18 : 15} />
            Vídeo
          </span>
        ) : null}
      </PostImageFrame>
    );
  }

  if (visual.kind === "video") {
    return (
      <>
        <video
          className={`post-visual-video ${isDetail ? "article-cover post-cover news-detail-image" : "post-card-image news-card-image"}`}
          src={visual.src}
          poster={visual.poster}
          controls={isDetail}
          muted={!isDetail}
          playsInline
          preload="metadata"
        />
        {!isDetail ? (
          <span className="video-badge">
            <Video size={15} />
            Vídeo
          </span>
        ) : null}
      </>
    );
  }

  return (
    <div className="video-fallback-visual post-visual-fallback">
      <Video size={isDetail ? 44 : 32} />
      <span>Vídeo</span>
    </div>
  );
}

function getPublicRoute() {
  const path = window.location.pathname.toLowerCase();
  const segments = path.split("/").filter(Boolean);
  const section: PublicSection = path.startsWith("/noticias") || path.startsWith("/materias")
    ? "news"
    : path.startsWith("/contato")
      ? "contact"
      : "about";

  return {
    section,
    selectedId: section === "news" ? segments[1] || "" : "",
  } as const;
}

function setPublicRoute(section: PublicSection, postId = "") {
  const path =
    section === "news"
      ? `/noticias${postId ? `/${encodeURIComponent(postId)}` : ""}`
      : section === "contact"
        ? "/contato"
        : "/";

  if (window.location.pathname !== path) {
    window.history.pushState({}, "", path);
  }
}

function Logo() {
  return (
    <div className="brand">
      <img src="/adehasc-logo.png" srcSet={logoSrcSet} alt="ADEHASC" />
    </div>
  );
}

function StatusPill({ status }: { status: Post["status"] }) {
  return (
    <span className={`status-pill ${status}`}>
      <CheckCircle2 size={14} />
      {status === "published" ? "Publicado" : "Rascunho"}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <FileText size={34} />
      <p>{text}</p>
    </div>
  );
}

function MediaLightbox({
  item,
  onClose,
}: {
  item: MediaItem;
  onClose: () => void;
}) {
  const embed = item.type === "video" ? getVideoEmbed(item.src) : item.src;

  return (
    <div className="media-lightbox" role="dialog" aria-modal="true">
      <button className="lightbox-backdrop" onClick={onClose} type="button" aria-label="Fechar" />
      <div className="lightbox-panel">
        <button className="icon-button lightbox-close" onClick={onClose} type="button" title="Fechar">
          <X size={20} />
        </button>
        {item.type === "image" ? (
          <img src={item.src} alt={item.caption || item.name} onError={handleImageError} />
        ) : isEmbeddedVideo(item.src) ? (
          <iframe
            src={embed}
            title={item.caption || item.name}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video src={item.src} poster={getVideoThumbnail(item.src) || undefined} controls autoPlay />
        )}
        {item.caption ? <p>{item.caption}</p> : null}
      </div>
    </div>
  );
}

function MediaViewer({
  item,
  layoutClass = "",
  onOpen,
}: {
  item: MediaItem;
  layoutClass?: string;
  onOpen: (item: MediaItem) => void;
}) {
  if (item.type === "image") {
    return (
      <figure className={`media-card compact-media-card ${layoutClass}`}>
        <button className="media-open" onClick={() => onOpen(item)} type="button">
          <img
            src={item.src}
            alt={item.caption || item.name}
            loading="lazy"
            onError={handleImageError}
          />
          <span>Expandir</span>
        </button>
        {item.caption ? <figcaption>{item.caption}</figcaption> : null}
      </figure>
    );
  }

  const embed = getVideoEmbed(item.src);

  return (
    <figure className={`media-card video-card compact-media-card ${layoutClass}`}>
      {isEmbeddedVideo(item.src) ? (
        <button className="video-open" onClick={() => onOpen(item)} type="button">
          <Video size={30} />
          <span>Expandir vídeo</span>
        </button>
      ) : (
        <button className="media-open" onClick={() => onOpen(item)} type="button">
          <video src={item.src} poster={getVideoThumbnail(item.src) || undefined} muted preload="metadata" playsInline />
          <span>Expandir</span>
        </button>
      )}
      {item.caption ? <figcaption>{item.caption}</figcaption> : null}
    </figure>
  );
}

function VideoPreview({ item }: { item: MediaItem }) {
  if (isEmbeddedVideo(item.src)) {
    return (
      <iframe
        className="video-thumb-frame"
        src={getVideoEmbed(item.src)}
        title={item.caption || item.name}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return (
    <video
      className="video-thumb-frame"
      src={item.src}
      poster={getVideoThumbnail(item.src) || undefined}
      controls
      muted
      preload="metadata"
      playsInline
    />
  );
}

const mosaicClasses = [
  "mosaic-large",
  "mosaic-wide",
  "mosaic-tall",
  "mosaic-square",
  "mosaic-strip",
];

const newsTileClasses = ["tile-large", "tile-wide", "tile-tall", "tile-compact"];

const workAreas = [
  {
    icon: Building2,
    title: "REURB",
    text: "Apoio técnico, jurídico, documental, social e organizacional em processos de Regularização Fundiária Urbana.",
  },
  {
    icon: Scale,
    title: "Lar Legal",
    text: "Acompanhamento de processos judiciais de regularização, com foco na matrícula individualizada.",
  },
  {
    icon: Users,
    title: "Cadastro de moradores",
    text: "Organização de informações, documentos, assinaturas e dados sociais necessários para cada núcleo.",
  },
  {
    icon: Map,
    title: "Topografia e mapas",
    text: "Levantamentos técnicos, delimitação de núcleos, identificação de lotes e memoriais descritivos.",
  },
  {
    icon: FileCheck2,
    title: "Apoio documental",
    text: "Cartas de anuência, contratos, declarações, peças técnicas e organização dos protocolos.",
  },
  {
    icon: Home,
    title: "Entrega de matrículas",
    text: "Acompanhamento até a emissão e entrega organizada das matrículas, quando cumpridos os requisitos legais.",
  },
];

const regularizationBenefits = [
  "Segurança jurídica",
  "Matrícula individualizada",
  "Valorização do imóvel",
  "Venda, transferência e herança com mais tranquilidade",
  "Organização da comunidade",
  "Fortalecimento da cidadania",
  "Mais dignidade para as famílias",
  "Melhor planejamento urbano para o município",
];

const processSteps = [
  {
    title: "Mobilização da comunidade",
    text: "Audiências públicas, reuniões e contato com moradores e lideranças locais.",
  },
  {
    title: "Cadastro dos moradores",
    text: "Coleta de documentos pessoais, comprovantes, contratos, declarações e informações necessárias.",
  },
  {
    title: "Levantamento técnico",
    text: "Topografia, mapas, identificação dos lotes, delimitação do núcleo e análise da área.",
  },
  {
    title: "Organização jurídica e documental",
    text: "Análise dos documentos, cartas de anuência, memoriais e demais elementos técnicos.",
  },
  {
    title: "Protocolo e acompanhamento",
    text: "Encaminhamento pela via adequada, seja REURB ou Lar Legal, com acompanhamento junto aos órgãos competentes.",
  },
  {
    title: "Cumprimento de exigências",
    text: "Atendimento de despachos, exigências cartorárias, complementações técnicas e documentais.",
  },
  {
    title: "Emissão e entrega das matrículas",
    text: "Após aprovação dos órgãos competentes, ocorre a emissão das matrículas individualizadas.",
  },
];

const valueItems = [
  "Segurança jurídica",
  "Dignidade",
  "Transparência",
  "Responsabilidade técnica",
  "Compromisso social",
  "Ética",
  "Respeito às famílias",
  "Parceria com municípios",
  "Desenvolvimento urbano sustentável",
  "Organização documental e territorial",
];

const whyChooseItems = [
  {
    icon: CalendarDays,
    title: "Desde 1988",
    text: "Criada em 16 de junho de 1988, a ADEHASC caminha rumo aos 40 anos de história.",
  },
  {
    icon: ClipboardList,
    title: "Processo completo",
    text: "Do cadastro à matrícula, com apoio técnico, jurídico, social, documental e topográfico.",
  },
  {
    icon: Handshake,
    title: "Parceria institucional",
    text: "Atuação com moradores, lideranças, prefeituras, cartórios e órgãos públicos.",
  },
  {
    icon: ShieldCheck,
    title: "Transparência",
    text: "Cada etapa é explicada de forma clara, com responsabilidade e respeito às famílias.",
  },
];

const impactCards = [
  { label: "Anos de atuação", value: "Desde 1988" },
  { label: "Municípios atendidos", value: "215" },
  { label: "Núcleos em regularização", value: "1.584" },
  { label: "Matrículas emitidas", value: "Mais de 40.000" },
  { label: "Famílias beneficiadas", value: "Mais de 50.000" },
];

function getStableVariant(value: string, index: number, variants: string[]) {
  const seed = Array.from(value).reduce(
    (sum, character) => sum + character.charCodeAt(0),
    index * 31,
  );
  return variants[seed % variants.length];
}

function SiteFooter() {
  return (
    <footer className="site-footer" id="contatos">
      <div className="footer-about">
        <img src="/adehasc-logo.png" srcSet={logoSrcSet} alt="ADEHASC" />
        <p>
          Desde 1988, a ADEHASC atua pelo desenvolvimento habitacional sustentável,
          pela regularização fundiária e pela segurança jurídica das famílias.
        </p>
        <strong>
          ADEHASC — Associação para o Desenvolvimento Habitacional Sustentável de Santa Catarina
        </strong>
        <span>CNPJ 78.486.875/0001-32</span>
      </div>

      <div className="footer-column footer-contact">
        <h2>Contatos</h2>
        <a href={contactPhoneHref}>
          <Phone size={18} /> {contactPhoneDisplay}
        </a>
        <a href={`mailto:${contactEmail}`}>
          <Mail size={18} /> {contactEmail}
        </a>
        <a href={contactWhatsAppHref} target="_blank" rel="noreferrer">
          <MessageCircle size={18} /> WhatsApp
        </a>
        <a href={matrixMapsHref} target="_blank" rel="noreferrer">
          <MapPin size={18} />
          <span>
            <strong>{matrixLabel}</strong>: {matrixAddress}
          </span>
        </a>
        <span>
          <BadgeCheck size={18} /> Presidente: Djalma Morell
        </span>
      </div>
    </footer>
  );
}

function AboutHome({
  onOpenContact,
  onOpenNews,
}: {
  onOpenContact: () => void;
  onOpenNews: () => void;
}) {
  return (
    <div className="about-home">
      <section className="about-hero">
        <div className="about-copy">
          <span>Caminhando rumo aos 40 anos de história</span>
          <h1>ADEHASC: desde 1988 transformando moradia em segurança jurídica</h1>
          <p>
            Regularização fundiária, desenvolvimento habitacional e dignidade para
            famílias, comunidades e municípios. Do cadastro à matrícula, a ADEHASC
            acompanha cada etapa com responsabilidade técnica e compromisso social.
          </p>
          <div className="about-actions">
            <a className="primary-button" href="#atuacao">
              <Route size={18} />
              Conheça nosso trabalho
            </a>
            <button className="ghost-button" onClick={onOpenContact} type="button">
              <Phone size={17} />
              Fale com a ADEHASC
            </button>
            <a className="ghost-button" href="#regularizacao">
              <FileText size={17} />
              Entenda a regularização
            </a>
          </div>
        </div>

        <div className="about-card">
          <img src="/adehasc-logo.png" srcSet={logoSrcSet} alt="ADEHASC" />
          <strong>
            Associação para o Desenvolvimento Habitacional Sustentável de Santa Catarina
          </strong>
          <span>CNPJ 78.486.875/0001-32</span>
          <div className="about-card-list">
            <span>
              <CalendarDays size={16} />
              Fundação: 16 de junho de 1988
            </span>
            <span>
              <BadgeCheck size={16} />
              Presidente: Djalma Morell
            </span>
            <span>
              <Globe size={16} />
              www.adehasc.com.br
            </span>
          </div>
        </div>
      </section>

      <section className="institutional-intro">
        <article>
          <span>Sobre a ADEHASC</span>
          <h2>Transformando moradia em direito, insegurança em cidadania.</h2>
          <p>
            A ADEHASC nasceu em 16 de junho de 1988 com o compromisso de promover
            desenvolvimento habitacional, cidadania e dignidade. Ao longo de sua
            trajetória, consolidou sua atuação na regularização fundiária, acompanhando
            comunidades que buscam sair da informalidade e conquistar segurança jurídica.
          </p>
          <p>
            Nosso trabalho envolve muito mais do que documentos. Cada processo representa
            famílias que desejam viver com tranquilidade, ter seu imóvel reconhecido e
            construir um futuro com mais dignidade.
          </p>
        </article>
        <aside className="mission-panel">
          <div>
            <span>Missão</span>
            <p>
              Promover o desenvolvimento habitacional sustentável e a regularização
              fundiária, garantindo às famílias mais segurança jurídica, dignidade,
              cidadania e tranquilidade para o futuro.
            </p>
          </div>
          <div>
            <span>Visão</span>
            <p>
              Ser referência em regularização fundiária, com responsabilidade técnica,
              transparência, compromisso social e respeito às famílias e aos municípios.
            </p>
          </div>
        </aside>
      </section>

      <section className="section-block" id="atuacao">
        <div className="section-heading">
          <span>Nossa atuação</span>
          <h2>O que a ADEHASC faz</h2>
          <p>
            Atuamos em processos de REURB, Programa Lar Legal e apoio técnico, jurídico,
            social, documental e topográfico para moradores, lideranças e municípios.
          </p>
        </div>
        <div className="service-grid">
          {workAreas.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title}>
                <Icon size={24} />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="regularization-section" id="regularizacao">
        <div className="section-heading">
          <span>Regularização fundiária</span>
          <h2>O que é Regularização Fundiária?</h2>
          <p>
            A regularização fundiária é o processo que transforma uma situação de
            ocupação informal em uma situação juridicamente reconhecida. Ela organiza
            documentos, identifica moradores, delimita lotes, analisa a área e busca
            garantir a matrícula individualizada do imóvel.
          </p>
          <p>
            Mais do que um documento, a regularização representa segurança, dignidade e
            tranquilidade para a família.
          </p>
        </div>
        <div className="benefit-grid">
          {regularizationBenefits.map((benefit) => (
            <span key={benefit}>
              <CheckCircle2 size={17} />
              {benefit}
            </span>
          ))}
        </div>
        <div className="alert-note">
          <ShieldCheck size={22} />
          <p>
            A regularização fundiária não acontece do dia para a noite. É um processo
            sério, com etapas técnicas, jurídicas, sociais, ambientais e documentais.
            Obras como pavimentação, esgoto, água ou iluminação dependem de políticas
            públicas, planejamento e recursos do município.
          </p>
        </div>
      </section>

      <section className="comparison-section">
        <div className="section-heading">
          <span>Caminhos para a regularização</span>
          <h2>REURB e Lar Legal</h2>
          <p>
            Cada núcleo possui uma realidade. Por isso, a ADEHASC analisa o melhor
            caminho, seja pela REURB, pelo Programa Lar Legal ou pela estratégia mais
            segura conforme a situação jurídica, urbanística e documental da área.
          </p>
        </div>
        <div className="comparison-grid">
          <article>
            <Landmark size={25} />
            <h3>REURB</h3>
            <ul>
              <li>Procedimento administrativo.</li>
              <li>Previsto na Lei Federal nº 13.465/2017.</li>
              <li>Conduzido pelo Município.</li>
              <li>Envolve aspectos jurídicos, urbanísticos, ambientais e sociais.</li>
              <li>Quando cumpridos os requisitos, permite a emissão da matrícula.</li>
            </ul>
          </article>
          <article>
            <Scale size={25} />
            <h3>Lar Legal</h3>
            <ul>
              <li>Procedimento judicial utilizado especialmente em Santa Catarina.</li>
              <li>Conduzido com análise do Poder Judiciário.</li>
              <li>Conta com participação do Ministério Público.</li>
              <li>Tem como foco a titulação e a matrícula individualizada.</li>
              <li>É alternativa importante quando a via administrativa não é a mais adequada.</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <span>Como trabalhamos</span>
          <h2>Da comunidade à matrícula</h2>
          <p>
            O processo exige responsabilidade, cuidado e respeito à legislação. Cada
            avanço é importante para garantir segurança jurídica às famílias.
          </p>
        </div>
        <ol className="process-list">
          {processSteps.map((step, index) => (
            <li key={step.title}>
              <strong>{String(index + 1).padStart(2, "0")}</strong>
              <div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="why-section">
        <div className="section-heading">
          <span>Por que escolher a ADEHASC?</span>
          <h2>Regularização fundiária feita com responsabilidade</h2>
        </div>
        <div className="why-grid">
          {whyChooseItems.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title}>
                <Icon size={24} />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="transparency-section">
        <div>
          <span>Transparência</span>
          <h2>Segurança também nas condições do processo</h2>
          <p>
            Na ADEHASC, a transparência faz parte do processo. As famílias são
            orientadas sobre as etapas, documentos, responsabilidades e condições de
            pagamento. Em regra, a cobrança ocorre após a entrega da matrícula,
            garantindo mais segurança e confiança aos moradores.
          </p>
        </div>
        <HeartHandshake size={56} />
      </section>

      <section className="impact-section">
        <div className="section-heading">
          <span>História e impacto social</span>
          <h2>Uma trajetória de compromisso com as famílias</h2>
          <p>
            Desde 1988, a ADEHASC atua na promoção do desenvolvimento habitacional e
            da regularização fundiária, levando segurança jurídica a famílias que
            aguardavam há anos pelo reconhecimento de seus imóveis.
          </p>
        </div>
        <div className="impact-grid">
          {impactCards.map((item) => (
            <article key={item.label}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </article>
          ))}
        </div>
        <div className="values-wrap" aria-label="Valores da ADEHASC">
          {valueItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section className="stories-section">
        <div className="section-heading">
          <span>Notícias e histórias</span>
          <h2>Entregas e atuações podem virar cases no portal</h2>
          <p>
            A equipe poderá inserir relatos, fotos, vídeos e matérias sobre entregas
            de matrículas, audiências públicas, mobilizações e avanços de cada núcleo.
          </p>
        </div>
        <button className="ghost-button" onClick={onOpenNews} type="button">
          <Newspaper size={18} />
          Ver notícias publicadas
        </button>
      </section>

      <section className="final-cta">
        <div>
          <span>Fale com a ADEHASC</span>
          <h2>Quer regularizar sua comunidade ou município?</h2>
          <p>
            A ADEHASC pode auxiliar na construção do caminho mais seguro para a
            regularização fundiária, com responsabilidade, transparência e compromisso social.
          </p>
        </div>
        <button className="primary-button" onClick={onOpenContact} type="button">
          Fale com a ADEHASC
          <ArrowRight size={18} />
        </button>
      </section>
    </div>
  );
}

function ContactPage() {
  return (
    <section className="contact-page">
      <div className="contact-hero">
        <span>Atendimento</span>
        <h1>Fale com a ADEHASC</h1>
        <p>
          Entre em contato com a nossa equipe para tirar dúvidas sobre regularização
          fundiária, REURB, Programa Lar Legal, andamento de processos ou atendimento
          aos moradores.
        </p>
      </div>

      <div className="contact-grid" aria-label="Opções de contato">
        <article className="contact-card">
          <Mail size={28} />
          <h2>Enviar e-mail</h2>
          <p>Envie sua dúvida ou solicitação para nossa equipe.</p>
          <a className="primary-button" href={`mailto:${contactEmail}`}>
            Enviar e-mail
            <ArrowRight size={18} />
          </a>
        </article>

        <article className="contact-card">
          <Phone size={28} />
          <h2>Ligar para a ADEHASC</h2>
          <p>Fale diretamente com nossa equipe pelo telefone oficial.</p>
          <a className="primary-button" href={contactPhoneHref}>
            Ligar agora
            <ArrowRight size={18} />
          </a>
        </article>

        <article className="contact-card">
          <MessageCircle size={28} />
          <h2>WhatsApp</h2>
          <p>Envie uma mensagem pelo WhatsApp para atendimento.</p>
          <a className="primary-button" href={contactWhatsAppHref} target="_blank" rel="noreferrer">
            Chamar no WhatsApp
            <ArrowRight size={18} />
          </a>
        </article>
      </div>

      <aside className="contact-note">
        <strong>ADEHASC — Associação para o Desenvolvimento Habitacional Sustentável de Santa Catarina</strong>
        <span>CNPJ 78.486.875/0001-32</span>
        <span>Presidente: Djalma Morell</span>
        <a className="contact-location" href={matrixMapsHref} target="_blank" rel="noreferrer">
          <MapPin size={18} />
          <span>
            <strong>{matrixLabel}</strong>: {matrixAddress}
          </span>
        </a>
      </aside>
    </section>
  );
}

function NewsCard({
  layoutClass,
  post,
  isSelected,
  onClick,
}: {
  layoutClass: string;
  post: Post;
  isSelected: boolean;
  onClick: () => void;
}) {
  const visual = getPostVisual(post);

  return (
    <button
      className={`news-card ${layoutClass} ${isSelected ? "selected" : ""}`}
      onClick={onClick}
      type="button"
    >
      <div className="news-card-cover news-card-image-wrapper post-card-image-wrapper post-visual-wrapper">
        <PostVisualFrame visual={visual} variant="card" />
      </div>
      <div className="news-card-body">
        <span>{post.category}</span>
        <strong>{post.title || "Matéria sem título"}</strong>
        <p>{post.excerpt}</p>
        <div className="news-card-meta">
          <small>{formatDate(post.updatedAt)}</small>
          <em>Ler matéria</em>
        </div>
      </div>
    </button>
  );
}

function PublicPortal({
  posts,
  isLoading,
  notice,
  onRefresh,
}: {
  posts: Post[];
  isLoading: boolean;
  notice: string;
  onRefresh: () => void;
}) {
  const initialRoute = getPublicRoute();
  const [section, setSection] = useState<PublicSection>(initialRoute.section);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [mediaFilter, setMediaFilter] = useState("Tudo");
  const [selectedId, setSelectedId] = useState(initialRoute.selectedId);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [expandedMedia, setExpandedMedia] = useState<MediaItem | null>(null);

  const filteredPosts = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return posts
      .filter((post) => post.status === "published")
      .filter((post) => category === "Todas" || post.category === category)
      .filter((post) => {
        if (mediaFilter === "Fotos") {
          return post.media.some((item) => item.type === "image") || Boolean(post.cover);
        }
        if (mediaFilter === "Vídeos") {
          return post.media.some((item) => item.type === "video");
        }
        return true;
      })
      .filter((post) => {
        if (!needle) {
          return true;
        }
        return [post.title, post.excerpt, post.category, post.body]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      });
  }, [category, mediaFilter, posts, query]);

  const selectedPost = selectedId
    ? filteredPosts.find((post) => post.id === selectedId) || null
    : null;
  const selectedVisual = selectedPost ? getPostVisual(selectedPost) : null;
  const selectedCoverItem =
    selectedPost && selectedVisual ? createCoverLightboxItem(selectedPost, selectedVisual) : null;

  useEffect(() => {
    if (!isLoading && selectedId && !filteredPosts.some((post) => post.id === selectedId)) {
      setSelectedId("");
    }
  }, [filteredPosts, isLoading, selectedId]);

  useEffect(() => {
    const handlePublicPop = () => {
      const route = getPublicRoute();
      setSection(route.section);
      setSelectedId(route.selectedId);
      setIsMenuOpen(false);
    };

    window.addEventListener("popstate", handlePublicPop);
    return () => window.removeEventListener("popstate", handlePublicPop);
  }, []);

  function openAbout() {
    setSection("about");
    setSelectedId("");
    setIsMenuOpen(false);
    setPublicRoute("about");
  }

  function openNews() {
    setSection("news");
    setSelectedId("");
    setIsMenuOpen(false);
    setPublicRoute("news");
  }

  function openContact() {
    setSection("contact");
    setSelectedId("");
    setIsMenuOpen(false);
    setPublicRoute("contact");
  }

  function selectNews(post: Post) {
    setSelectedId(post.id);
    setPublicRoute("news", post.id);
  }

  const pageTitle = {
    about: "Sobre nós",
    news: "Notícias",
    contact: "Contato",
  }[section];

  const pageSubtitle = {
    about: "Conheça a ADEHASC",
    news: "Matérias publicadas",
    contact: "Canais de atendimento",
  }[section];

  return (
    <main className="public-page">
      <section className="window feed-window public-window">
        <div className="window-bar public-window-bar">
          <button
            className="icon-button menu-button"
            onClick={() => setIsMenuOpen((current) => !current)}
            type="button"
            title="Abrir menu"
          >
            <Ellipsis size={21} />
          </button>
          <div className="public-window-title">
            <span>{pageTitle}</span>
            <strong>{pageSubtitle}</strong>
          </div>
          <div className="public-window-actions">
            <div className="public-tabs" role="tablist" aria-label="Navegação pública">
              <button
                aria-selected={section === "about"}
                className={section === "about" ? "active" : ""}
                onClick={openAbout}
                role="tab"
                type="button"
              >
                Sobre nós
              </button>
              <button
                aria-selected={section === "news"}
                className={section === "news" ? "active" : ""}
                onClick={openNews}
                role="tab"
                type="button"
              >
                Notícias
              </button>
              <button
                aria-selected={section === "contact"}
                className={section === "contact" ? "active" : ""}
                onClick={openContact}
                role="tab"
                type="button"
              >
                Contato
              </button>
            </div>
            {section === "news" ? (
              <button className="icon-button" onClick={onRefresh} type="button" title="Atualizar">
                <RefreshCw size={18} />
              </button>
            ) : null}
          </div>
        </div>

        {isMenuOpen ? (
          <div className="settings-layer">
            <button
              className="settings-scrim"
              onClick={() => setIsMenuOpen(false)}
              type="button"
              aria-label="Fechar menu"
            />
            <aside className="settings-panel">
              <div>
                <span>Menu</span>
                <strong>Navegação</strong>
              </div>
              <nav className="nav-list" aria-label="Páginas">
                <button
                  className={section === "about" ? "active" : ""}
                  onClick={openAbout}
                  type="button"
                >
                  <FileText size={18} />
                  <span>Sobre nós</span>
                </button>
                <button
                  className={section === "news" ? "active" : ""}
                  onClick={openNews}
                  type="button"
                >
                  <Newspaper size={18} />
                  <span>Notícias</span>
                </button>
                <button
                  className={section === "contact" ? "active" : ""}
                  onClick={openContact}
                  type="button"
                >
                  <Phone size={18} />
                  <span>Contato</span>
                </button>
              </nav>
              {section === "news" ? (
                <>
                  <div>
                    <span>Filtros</span>
                    <strong>Categorias</strong>
                  </div>
                  <nav className="nav-list" aria-label="Categorias">
                    {categories.map((item) => (
                      <button
                        className={item === category ? "active" : ""}
                        key={item}
                        onClick={() => {
                          setCategory(item);
                          setSelectedId("");
                          setIsMenuOpen(false);
                        }}
                        type="button"
                      >
                        <Newspaper size={18} />
                        <span>{item}</span>
                      </button>
                    ))}
                  </nav>
                  <div className="settings-group">
                    <span>Tipo de mídia</span>
                    <div className="segmented vertical">
                      {mediaFilters.map((filter) => (
                        <button
                          className={filter === mediaFilter ? "active" : ""}
                          key={filter}
                          onClick={() => {
                            setMediaFilter(filter);
                            setSelectedId("");
                            setIsMenuOpen(false);
                          }}
                          type="button"
                        >
                          {filter}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </aside>
          </div>
        ) : null}

        {section === "about" ? (
          <AboutHome onOpenContact={openContact} onOpenNews={openNews} />
        ) : section === "contact" ? (
          <ContactPage />
        ) : (
          <section className="news-section">
            <div className="command-bar public-command-bar">
              <label className="search-box">
                <Search size={18} />
                <input
                  aria-label="Pesquisar matérias"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Pesquisar notícias"
                  value={query}
                />
              </label>
            </div>

            {notice ? <div className="notice">{notice}</div> : null}

            <div className="news-grid" aria-label="Lista de notícias">
              {isLoading && filteredPosts.length === 0 ? (
                <EmptyState text="Carregando notícias..." />
              ) : null}
              {!isLoading && filteredPosts.length === 0 ? (
                <EmptyState text="Nenhuma notícia publicada nesta seleção." />
              ) : null}
              {filteredPosts.map((post, index) => (
                <NewsCard
                  isSelected={selectedPost?.id === post.id}
                  key={post.id}
                  layoutClass={getStableVariant(post.id + (post.cover || ""), index, newsTileClasses)}
                  onClick={() => selectNews(post)}
                  post={post}
                />
              ))}
            </div>

            {selectedPost ? (
              <article className="reader-pane news-detail">
                <div className="article-head">
                  <span>{selectedPost.category}</span>
                  <h1>{selectedPost.title}</h1>
                  <p>{selectedPost.excerpt}</p>
                  <small>Atualizado em {formatDate(selectedPost.updatedAt)}</small>
                </div>
                {selectedVisual?.kind === "video" ? (
                  <div className="cover-frame expanded-cover article-cover-frame article-cover-image-wrapper post-cover-image-wrapper post-visual-wrapper">
                    <PostVisualFrame visual={selectedVisual} variant="detail" />
                  </div>
                ) : selectedVisual ? (
                  <button
                    className="cover-frame expanded-cover article-cover-frame article-cover-image-wrapper post-cover-image-wrapper post-visual-wrapper"
                    onClick={() => {
                      if (selectedCoverItem) {
                        setExpandedMedia(selectedCoverItem);
                      }
                    }}
                    type="button"
                  >
                    <PostVisualFrame visual={selectedVisual} variant="detail" />
                    <span className="cover-action-label">
                      {selectedCoverItem?.type === "video" ? "Abrir vídeo" : "Ampliar capa"}
                    </span>
                  </button>
                ) : null}
                <div className="article-body">
                  {splitParagraphs(selectedPost.body).map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
                {selectedPost.media.length > 0 ? (
                  <div className="media-grid compressed-media-grid">
                    {selectedPost.media.map((item, index) => (
                      <MediaViewer
                        item={item}
                        key={item.id}
                        layoutClass={getStableVariant(item.id + item.src, index, mosaicClasses)}
                        onOpen={setExpandedMedia}
                      />
                    ))}
                  </div>
                ) : null}
                <button
                  className="ghost-button detail-close"
                  onClick={() => {
                    setSelectedId("");
                    setPublicRoute("news");
                  }}
                  type="button"
                >
                  Fechar notícia
                </button>
              </article>
            ) : (
              <div className="news-hint">
                <Newspaper size={22} />
                <span>Clique em uma notícia para expandir a leitura.</span>
              </div>
            )}
          </section>
        )}
      </section>
      <SiteFooter />
      {expandedMedia ? (
        <MediaLightbox item={expandedMedia} onClose={() => setExpandedMedia(null)} />
      ) : null}
    </main>
  );
}

function AdminLogin({
  error,
  onLogin,
}: {
  error: string;
  onLogin: (password: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onLogin(password);
  }

  return (
    <main className="login-wrap">
      <section className="window login-window">
        <Logo />
        <form onSubmit={handleSubmit}>
          <label>
            <span>Senha ADM</span>
            <div className="input-with-icon password-field">
              <Lock size={18} />
              <input
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={showPassword}
                className="password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="primary-button" type="submit">
            <LayoutDashboard size={18} />
            Entrar
          </button>
        </form>
      </section>
    </main>
  );
}

function AdminEditor({
  adminPassword,
  onLogout,
}: {
  adminPassword: string;
  onLogout: () => void;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [editing, setEditing] = useState<PostInput>(createBlankPost);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");

  const sortedPosts = useMemo(
    () =>
      [...posts].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [posts],
  );

  async function loadAdminPosts() {
    setStatus("Carregando painel...");
    try {
      const data = await fetchPosts(adminPassword);
      setPosts(data);
      if (data[0]) {
        setSelectedId(data[0].id);
        setEditing(data[0]);
      } else {
        setSelectedId("");
        setEditing(createBlankPost());
      }
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao carregar o painel.");
    }
  }

  useEffect(() => {
    void loadAdminPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateEditing<K extends keyof PostInput>(key: K, value: PostInput[K]) {
    setEditing((current) => ({ ...current, [key]: value }));
  }

  function selectPost(post: Post) {
    setSelectedId(post.id);
    setEditing(post);
    setStatus("");
  }

  function addVideoUrl() {
    const rawUrl = videoUrl.trim();

    if (!rawUrl) {
      return;
    }

    if (isLocalFileReference(rawUrl)) {
      setStatus(
        `Caminho local não vira vídeo público. Use "Enviar fotos/vídeos" para escolher o arquivo no computador. ${uploadGuidance}`,
      );
      return;
    }

    const cleanUrl = normalizeVideoInput(rawUrl);

    if (!cleanUrl) {
      setStatus(
        "Cole uma URL pública válida de vídeo: YouTube, Shorts, Vimeo, Drive, Facebook, Instagram, TikTok ou link direto .mp4/.webm/.mov.",
      );
      return;
    }

    const item: MediaItem = {
      id: crypto.randomUUID(),
      type: "video",
      src: cleanUrl,
      name: "Vídeo externo",
    };

    updateEditing("media", [...editing.media, item]);
    setVideoUrl("");
    setStatus("Vídeo adicionado. Salve a matéria para publicar.");
  }

  async function handleUpload(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    setStatus("Enviando mídia...");
    try {
      const uploaded: MediaItem[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await uploadMedia(file, adminPassword));
      }
      const firstImage = uploaded.find((item) => item.type === "image");
      setEditing((current) => ({
        ...current,
        cover: firstImage?.src || current.cover,
        media: [...current.media, ...uploaded],
      }));
      setStatus("Mídia adicionada.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao enviar mídia.");
    }
  }

  async function handleSave() {
    if (!editing.title.trim()) {
      setStatus("Informe o título da matéria.");
      return;
    }

    setIsSaving(true);
    setStatus("Salvando matéria...");
    try {
      const saved = await savePost(editing, adminPassword);
      setPosts((current) => {
        const exists = current.some((post) => post.id === saved.id);
        return exists
          ? current.map((post) => (post.id === saved.id ? saved : post))
          : [saved, ...current];
      });
      setSelectedId(saved.id);
      setEditing(saved);
      setStatus("Matéria salva.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao salvar matéria.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!editing.id) {
      setEditing(createBlankPost());
      return;
    }

    const shouldDelete = window.confirm("Excluir esta matéria?");
    if (!shouldDelete) {
      return;
    }

    setStatus("Excluindo matéria...");
    try {
      await deletePost(editing.id, adminPassword);
      const remaining = posts.filter((post) => post.id !== editing.id);
      setPosts(remaining);
      setSelectedId(remaining[0]?.id || "");
      setEditing(remaining[0] || createBlankPost());
      setStatus("Matéria excluída.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao excluir matéria.");
    }
  }

  function removeMedia(id: string) {
    setEditing((current) => ({
      ...current,
      media: current.media.filter((item) => item.id !== id),
    }));
  }

  return (
    <main className="admin-grid">
      <aside className="side-panel admin-side">
        <Logo />
        <button className="primary-button" onClick={() => {
          setEditing(createBlankPost());
          setSelectedId("");
        }} type="button">
          <Plus size={18} />
          Nova matéria
        </button>
        <div className="admin-list">
          {sortedPosts.map((post) => (
            <button
              className={post.id === selectedId ? "selected" : ""}
              key={post.id}
              onClick={() => selectPost(post)}
              type="button"
            >
              <span>{post.category}</span>
              <strong>{post.title || "Sem título"}</strong>
              <StatusPill status={post.status} />
            </button>
          ))}
        </div>
        <button className="ghost-button" onClick={onLogout} type="button">
          <LogOut size={18} />
          Sair
        </button>
      </aside>

      <section className="window editor-window">
        <div className="window-bar">
          <div>
            <span>Painel ADM</span>
            <strong>Editor de matérias</strong>
          </div>
          <div className="toolbar">
            <button className="ghost-button" onClick={handleDelete} type="button">
              <Trash2 size={18} />
              Excluir
            </button>
            <button
              className="primary-button"
              disabled={isSaving}
              onClick={handleSave}
              type="button"
            >
              <Save size={18} />
              {isSaving ? "Salvando" : "Salvar"}
            </button>
          </div>
        </div>

        {status ? <div className="notice admin-notice">{status}</div> : null}

        <div className="editor-layout">
          <form className="editor-form">
            <label>
              <span>Título</span>
              <input
                onChange={(event) => updateEditing("title", event.target.value)}
                value={editing.title}
              />
            </label>

            <div className="form-row">
              <label>
                <span>Categoria</span>
                <select
                  onChange={(event) => updateEditing("category", event.target.value)}
                  value={editing.category}
                >
                  {categories
                    .filter((item) => item !== "Todas")
                    .map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                </select>
              </label>
              <label>
                <span>Status</span>
                <select
                  onChange={(event) =>
                    updateEditing("status", event.target.value as Post["status"])
                  }
                  value={editing.status}
                >
                  <option value="published">Publicado</option>
                  <option value="draft">Rascunho</option>
                </select>
              </label>
            </div>

            <label className="check-line">
              <input
                checked={editing.featured}
                onChange={(event) => updateEditing("featured", event.target.checked)}
                type="checkbox"
              />
              <span>Destacar na lista pública</span>
            </label>

            <label>
              <span>Resumo</span>
              <textarea
                onChange={(event) => updateEditing("excerpt", event.target.value)}
                rows={3}
                value={editing.excerpt}
              />
            </label>

            <label>
              <span>Texto da matéria</span>
              <textarea
                className="body-textarea"
                onChange={(event) => updateEditing("body", event.target.value)}
                rows={11}
                value={editing.body}
              />
            </label>

            <label>
              <span>Capa</span>
              <input
                onChange={(event) => updateEditing("cover", event.target.value)}
                placeholder="/adehasc-logo.png"
                value={editing.cover || ""}
              />
            </label>

            <div className="cover-guidance" role="note">
              <strong>Imagem recomendada para capa: 1200 x 675 px, proporção 16:9.</strong>
              <p>Use imagens nessa proporção para evitar cortes na capa da postagem.</p>
              <p>
                Imagens verticais, quadradas, logos ou artes com texto serão ajustadas
                automaticamente para aparecerem inteiras, mas podem ficar com margens laterais
                ou superior/inferior.
              </p>
            </div>

            <div className="upload-line">
              <label className="upload-button">
                <UploadCloud size={18} />
                <span>Enviar fotos/vídeos</span>
                <input
                  accept="image/*,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
                  multiple
                  onChange={(event) => {
                    const input = event.currentTarget;
                    void handleUpload(input.files).finally(() => {
                      input.value = "";
                    });
                  }}
                  type="file"
                />
              </label>
              <div className="video-url">
                <Video size={18} />
                <input
                  inputMode="url"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addVideoUrl();
                    }
                  }}
                  onChange={(event) => setVideoUrl(event.target.value)}
                  placeholder="URL pública: YouTube, Shorts, Drive, Vimeo ou .mp4"
                  value={videoUrl}
                />
                <button onClick={addVideoUrl} type="button">
                  <Plus size={16} />
                </button>
              </div>
              <p className="upload-hint">{uploadGuidance}</p>
            </div>

            {editing.media.length > 0 ? (
              <div className="media-editor-grid">
                {editing.media.map((item) => (
                  <div className="media-editor-item" key={item.id}>
                    {item.type === "image" ? (
                      <img src={item.src} alt="" onError={handleImageError} />
                    ) : (
                      <VideoPreview item={item} />
                    )}
                    <input
                      onChange={(event) => {
                        const caption = event.target.value;
                        updateEditing(
                          "media",
                          editing.media.map((media) =>
                            media.id === item.id ? { ...media, caption } : media,
                          ),
                        );
                      }}
                      placeholder="Legenda"
                      value={item.caption || ""}
                    />
                    <div className="media-actions">
                      {item.type === "image" ? (
                        <button
                          onClick={() => updateEditing("cover", item.src)}
                          type="button"
                        >
                          <Camera size={15} />
                          Capa
                        </button>
                      ) : null}
                      <button onClick={() => removeMedia(item.id)} type="button">
                        <X size={15} />
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </form>

          <aside className="preview-pane">
            <span>Prévia</span>
            <div className="admin-image-preview-wrapper">
              <PostImageFrame
                alt=""
                className="admin-image-preview-frame"
                imageClassName="admin-image-preview"
                src={editing.cover || "/adehasc-logo.png"}
              />
            </div>
            <h2>{editing.title || "Título da matéria"}</h2>
            <p>{editing.excerpt || "Resumo da matéria"}</p>
            <StatusPill status={editing.status} />
          </aside>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  function pathIsAdmin(path: string) {
    const cleanPath = path.toLowerCase();
    return cleanPath.startsWith("/admin") || cleanPath.startsWith("/adm");
  }

  const [view, setView] = useState(() =>
    pathIsAdmin(window.location.pathname) ? "admin" : "public",
  );
  const [posts, setPosts] = useState<Post[]>(samplePosts);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [adminPassword, setAdminPassword] = useState(
    () => sessionStorage.getItem("adehasc-admin-password") || "",
  );
  const [loginError, setLoginError] = useState("");

  async function loadPublicPosts() {
    setIsLoading(true);
    try {
      const data = await fetchPosts();
      setPosts(data.length > 0 ? data : samplePosts);
      setNotice("");
    } catch {
      setPosts(samplePosts);
      setNotice("Exibindo conteúdo inicial enquanto a API é configurada.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadPublicPosts();
  }, []);

  useEffect(() => {
    const handlePop = () => {
      setView(pathIsAdmin(window.location.pathname) ? "admin" : "public");
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  async function handleLogin(password: string) {
    setLoginError("");
    try {
      await fetchPosts(password);
      sessionStorage.setItem("adehasc-admin-password", password);
      setAdminPassword(password);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Senha inválida.");
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("adehasc-admin-password");
    setAdminPassword("");
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="app-title">
          <img src="/adehasc-logo.png" srcSet={logoSrcSet} alt="ADEHASC" />
          <span>ADEHASC</span>
        </div>
        {view === "admin" ? (
          <div className="mode-chip">
            <Pencil size={17} />
            <span>ADM</span>
          </div>
        ) : null}
      </header>

      {view === "admin" ? (
        adminPassword ? (
          <AdminEditor adminPassword={adminPassword} onLogout={handleLogout} />
        ) : (
          <AdminLogin error={loginError} onLogin={handleLogin} />
        )
      ) : (
        <PublicPortal
          isLoading={isLoading}
          notice={notice}
          onRefresh={loadPublicPosts}
          posts={posts}
        />
      )}
    </div>
  );
}
