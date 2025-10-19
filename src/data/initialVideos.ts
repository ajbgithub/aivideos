export type VideoSource =
  | "file"
  | "youtube"
  | "instagram"
  | "tiktok"
  | "spotify"
  | "apple-podcasts"
  | "x"
  | "external";

export type TopRatedOverride = "feature" | "suppress";

export type StoredVideo = {
  id: string;
  title?: string;
  description?: string;
  url: string;
  source: VideoSource;
  uploader: {
    name: string;
    email: string;
  };
  createdAt: string;
  viewCount: number;
  isTopRated: boolean;
  categories: string[];
  fullName?: string;
  storageObjectPath?: string | null;
  topRatedOverride?: TopRatedOverride | null;
};

export const CATEGORY_OPTIONS = [
  "Animals",
  "Animation",
  "Action",
  "Cats",
  "Dogs",
  "Drama",
  "Fashion & Style",
  "Films",
  "Fitness & Health",
  "Food & Recipes",
  "Funnies",
  "Inspirational",
  "Lifestyle & Travel",
  "Memes",
  "Music Videos",
  "News",
  "Other",
  "Podcasts",
  "Pop Icons",
  "Romance",
  "Tech & Gadgets",
  "Trailers",
  "TV",
] as const;

export const INITIAL_VIDEOS: StoredVideo[] = [];
