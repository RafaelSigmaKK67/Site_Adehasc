export type MediaType = "image" | "video";

export interface MediaItem {
  id: string;
  type: MediaType;
  src: string;
  name: string;
  caption?: string;
}

export type PostStatus = "published" | "draft";

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
  createdAt: string;
  updatedAt: string;
}

export type PostInput = Omit<Post, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
};
