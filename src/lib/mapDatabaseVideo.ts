import type { StoredVideo, VideoSource } from "@/data/initialVideos";

export type DatabaseVideoRow = {
  id: string;
  title: string | null;
  description: string | null;
  video_url: string | null;
  source: string | null;
  storage_object_path: string | null;
  categories: string[] | null;
  full_name: string | null;
  view_count: number | null;
  is_top_rated: boolean | null;
  uploader_name: string | null;
  uploader_email: string | null;
  created_at: string | null;
};

export function mapDatabaseVideo(
  row: DatabaseVideoRow | null | undefined
): StoredVideo | null {
  if (!row || !row.id || !row.video_url) {
    return null;
  }

  const source = isValidVideoSource(row.source)
    ? (row.source as VideoSource)
    : "external";

  const uploaderName = row.uploader_name?.trim() || "Creator";

  return {
    id: row.id,
    title: row.title ?? undefined,
    description: row.description ?? undefined,
    url: row.video_url,
    source,
    uploader: {
      name: uploaderName,
      email: row.uploader_email ?? "",
    },
    createdAt: row.created_at ?? new Date().toISOString(),
    viewCount: row.view_count ?? 0,
    isTopRated: Boolean(row.is_top_rated),
    categories: Array.isArray(row.categories)
      ? row.categories
          .filter((category): category is string => Boolean(category))
          .slice(0, 3)
      : [],
    fullName: row.full_name ?? undefined,
  };
}

function isValidVideoSource(value: string | null): value is VideoSource {
  if (!value) {
    return false;
  }

  const allowed: VideoSource[] = [
    "file",
    "youtube",
    "instagram",
    "tiktok",
    "external",
  ];

  return allowed.includes(value as VideoSource);
}
