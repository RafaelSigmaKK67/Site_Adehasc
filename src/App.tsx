import {
  Camera,
  CheckCircle2,
  Ellipsis,
  FileText,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Newspaper,
  Phone,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  UploadCloud,
  Video,
  X,
} from "lucide-react";
import { FormEvent, SyntheticEvent, useEffect, useMemo, useState } from "react";
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

function getPublicRoute() {
  const path = window.location.pathname.toLowerCase();
  const segments = path.split("/").filter(Boolean);

  return {
    section: path.startsWith("/noticias") || path.startsWith("/materias") ? "news" : "about",
    selectedId: segments[1] || "",
  } as const;
}

function setPublicRoute(section: "about" | "news", postId = "") {
  const path = section === "news" ? `/noticias${postId ? `/${encodeURIComponent(postId)}` : ""}` : "/";

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
          <video src={item.src} controls autoPlay />
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
          <img src={item.src} alt={item.caption || item.name} onError={handleImageError} />
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
          <video src={item.src} muted />
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

  return <video className="video-thumb-frame" src={item.src} controls muted />;
}

const mosaicClasses = [
  "mosaic-large",
  "mosaic-wide",
  "mosaic-tall",
  "mosaic-square",
  "mosaic-strip",
];

const newsTileClasses = ["tile-large", "tile-wide", "tile-tall", "tile-compact"];

function getStableVariant(value: string, index: number, variants: string[]) {
  const seed = Array.from(value).reduce(
    (sum, character) => sum + character.charCodeAt(0),
    index * 31,
  );
  return variants[seed % variants.length];
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-about">
        <img src="/adehasc-logo.png" srcSet={logoSrcSet} alt="ADEHASC" />
        <p>
          Desenvolver atividades para suprir a necessidade de habitação da população e
          aproximar do lar regularizado.
        </p>
        <strong>
          ADEHASC – Associação para o Desenvolvimento Habitacional Sustentável de Santa Catarina
        </strong>
        <span>CNPJ 78.486.875/0001-32</span>
      </div>

      <div className="footer-column footer-contact">
        <h2>Contatos</h2>
        <span>
          <Phone size={18} /> (49) 3622-3137 – Sede Matriz
        </span>
        <span>
          <Phone size={18} /> (49) 98503-1080 – Sede Matriz Dúvidas
        </span>
        <span>
          <Phone size={18} /> (67) 99967-4655 – Sede Matriz - MS
        </span>
        <span>
          <Mail size={18} /> contato@adehasc.com.br
        </span>
        <span>
          <MapPin size={18} /> Endereço: Avenida Salgado Filho, Nº 559, Sala 01, Centro
        </span>
      </div>
    </footer>
  );
}

function AboutHome({ onOpenNews }: { onOpenNews: () => void }) {
  return (
    <div className="about-home">
      <section className="about-hero">
        <div className="about-copy">
          <span>Sobre nós</span>
          <h1>Moradia regularizada, famílias mais seguras.</h1>
          <p>
            A ADEHASC atua para aproximar a população do acesso à habitação, à informação
            habitacional e ao lar regularizado em Santa Catarina.
          </p>
          <button className="primary-button" onClick={onOpenNews} type="button">
            <Newspaper size={18} />
            Ver notícias
          </button>
        </div>

        <div className="about-card">
          <img src="/adehasc-logo.png" srcSet={logoSrcSet} alt="ADEHASC" />
          <strong>
            Associação para o Desenvolvimento Habitacional Sustentável de Santa Catarina
          </strong>
          <span>CNPJ 78.486.875/0001-32</span>
        </div>
      </section>

      <section className="about-info-grid" aria-label="Informações da ADEHASC">
        <article>
          <span>Missão</span>
          <p>
            Desenvolver atividades para suprir a necessidade de habitação da população e
            aproximar famílias do lar regularizado.
          </p>
        </article>
        <article>
          <span>Atuação</span>
          <p>
            Apoio em regularização fundiária, orientação habitacional e programas voltados à
            habitação urbana e rural.
          </p>
        </article>
        <article>
          <span>Informação</span>
          <p>
            Notícias, matérias, fotos e vídeos ficam reunidos em um espaço público de consulta.
          </p>
        </article>
      </section>
    </div>
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
  return (
    <button
      className={`news-card ${layoutClass} ${isSelected ? "selected" : ""}`}
      onClick={onClick}
      type="button"
    >
      <div className="news-card-cover">
        {post.cover ? (
          <img src={post.cover} alt="" onError={handleImageError} />
        ) : (
          <img src="/adehasc-logo.png" srcSet={logoSrcSet} alt="" />
        )}
      </div>
      <div className="news-card-body">
        <span>{post.category}</span>
        <strong>{post.title || "Matéria sem título"}</strong>
        <p>{post.excerpt}</p>
        <small>{formatDate(post.updatedAt)}</small>
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
  const [section, setSection] = useState<"about" | "news">(initialRoute.section);
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

  function selectNews(post: Post) {
    setSelectedId(post.id);
    setPublicRoute("news", post.id);
  }

  return (
    <main className="public-page">
      <section className="window feed-window public-window">
        <div className="window-bar public-window-bar">
          <button
            className="icon-button menu-button"
            onClick={() => setIsMenuOpen((current) => !current)}
            type="button"
            title="Abrir filtros"
          >
            <Ellipsis size={21} />
          </button>
          <div className="public-window-title">
            <span>{section === "about" ? "Sobre nós" : "Notícias"}</span>
            <strong>{section === "about" ? "Conheça a ADEHASC" : "Matérias publicadas"}</strong>
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
              aria-label="Fechar filtros"
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
          <AboutHome onOpenNews={openNews} />
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
                <button
                  className="cover-frame expanded-cover"
                  onClick={() =>
                    setExpandedMedia({
                      id: `${selectedPost.id}-cover`,
                      type: "image",
                      src: selectedPost.cover || "/adehasc-logo.png",
                      name: selectedPost.title,
                    })
                  }
                  type="button"
                >
                  <img
                    src={selectedPost.cover || "/adehasc-logo.png"}
                    alt=""
                    onError={handleImageError}
                  />
                  <span>Ampliar capa</span>
                </button>
                <div className="article-head">
                  <span>{selectedPost.category}</span>
                  <h1>{selectedPost.title}</h1>
                  <p>{selectedPost.excerpt}</p>
                  <small>Atualizado em {formatDate(selectedPost.updatedAt)}</small>
                </div>
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
            <div className="input-with-icon">
              <Lock size={18} />
              <input
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
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
            <div className="cover-frame small">
              <img
                src={editing.cover || "/adehasc-logo.png"}
                alt=""
                onError={handleImageError}
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
