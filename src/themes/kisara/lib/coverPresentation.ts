import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

type CoverEntry = {
  id: string;
  data: {
    cover?: string | null;
  };
};

export type KisaraCoverPresentation = {
  fit: "portrait" | "crop";
  width: number;
  height: number;
  aspectRatio: number;
  position: string;
};

const coverFocus: Record<string, string> = {
  "/blog-covers/cover-08.webp": "50% 30%"
};

export const getKisaraCoverPresentation = async (posts: readonly CoverEntry[]) =>
  new Map<string, KisaraCoverPresentation>(await Promise.all(posts.map(async (post) => {
    const cover = post.data.cover;
    const fallback: KisaraCoverPresentation = {
      fit: "portrait",
      width: 700,
      height: 990,
      aspectRatio: 0.7,
      position: coverFocus[cover ?? ""] ?? "50% 32%"
    };
    if (!cover?.startsWith("/")) return [post.id, fallback] as const;

    const sourcePath = path.join(process.cwd(), "public", cover.replace(/^\/+/, ""));
    if (!existsSync(sourcePath)) return [post.id, fallback] as const;

    try {
      const metadata = await sharp(sourcePath).metadata();
      const width = metadata.width ?? fallback.width;
      const height = metadata.height ?? fallback.height;
      const sourceAspectRatio = width / Math.max(1, height);
      const fit = sourceAspectRatio >= 0.85 ? "crop" : "portrait";
      return [post.id, {
        fit,
        width,
        height,
        aspectRatio: fit === "portrait" ? sourceAspectRatio : fallback.aspectRatio,
        position: coverFocus[cover] ?? "50% 32%"
      }] as const;
    } catch {
      return [post.id, fallback] as const;
    }
  })));
