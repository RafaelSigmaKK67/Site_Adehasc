export type MediaType = "image" | "video";

export interface MediaItem {
  id: string;
  type: MediaType;
  src: string;
  name: string;
  caption?: string;
}

export type PostStatus = "published" | "draft";

export type ImageLayout = "single" | "grid" | "carousel" | "featured" | "gallery";
export type ImageFit = "contain" | "cover";
export type ImageBackground = "white" | "blur" | "neutral";

export interface Post {
  id: string;
  title: string;
  category: string;
  excerpt: string;
  body: string;
  cover?: string;
  status: PostStatus;
  featured: boolean;
  media: MediaItem[];
  imageLayout?: ImageLayout;
  imageFit?: ImageFit;
  imageBackground?: ImageBackground;
  createdAt: string;
  updatedAt: string;
}

export type PostInput = Omit<Post, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
};
