export type VideoSource =
  | "file"
  | "youtube"
  | "instagram"
  | "tiktok"
  | "spotify"
  | "apple-podcasts"
  | "external";

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

export const INITIAL_VIDEOS: StoredVideo[] = [
  {
    id: "vid-ea-01",
    title: "Thunder - Wharton Vets Gala",
    description: "Live performance highlight from the Wharton Vets Gala showcase.",
    url: "https://www.instagram.com/reel/DPeTuiSEVMU/embed",
    source: "instagram",
    uploader: { name: "Andrew J. Bilden", email: "" },
    createdAt: new Date().toISOString(),
    viewCount: 0,
    isTopRated: true,
    categories: ["Music Videos", "Inspirational", "Trailers"],
    fullName: "Andrew J. Bilden",
  },
  {
    id: "vid-ea-02",
    title: "Newport '83",
    description: "Vintage-inspired visuals celebrating coastal life in Newport.",
    url: "https://www.youtube.com/embed/yXi2hPadEKE",
    source: "youtube",
    uploader: { name: "Andrew J. Bilden", email: "" },
    createdAt: new Date().toISOString(),
    viewCount: 0,
    isTopRated: true,
    categories: ["Films", "Trailers", "Romance"],
    fullName: "Andrew J. Bilden",
  },
  {
    id: "vid-ea-03",
    title: "White Paper Fan Teaser",
    description: "Teaser reel for the upcoming White Paper Fan release.",
    url: "https://www.instagram.com/reel/DNvUqWs4nsH/embed",
    source: "instagram",
    uploader: { name: "Andrew J. Bilden", email: "" },
    createdAt: new Date().toISOString(),
    viewCount: 0,
    isTopRated: true,
    categories: ["Trailers", "Action", "Films"],
    fullName: "Andrew J. Bilden",
  },
];
