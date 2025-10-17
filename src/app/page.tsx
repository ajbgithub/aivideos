"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type User = {
  name: string;
  email: string;
};

type VideoSource = "file" | "youtube" | "instagram" | "external";

type Video = {
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
};

type UploadPayload = {
  title: string;
  description: string;
  videoLink: string;
  videoFile: File | null;
};

const initialVideos: Video[] = [
  {
    id: "vid-27",
    title: "Dreamscapes in Motion",
    description: "AI-generated concept art stitched into a short teaser.",
    url: "https://www.youtube.com/embed/J---aiyznGQ",
    source: "youtube",
    uploader: { name: "Maya Chen", email: "maya.chen@example.com" },
    createdAt: new Date().toISOString(),
    viewCount: 18230,
    isTopRated: true,
  },
  {
    id: "vid-28",
    title: "Fashion Loop",
    description: "Short form Instagram reel showcasing AI-styled outfits.",
    url: "https://www.instagram.com/p/Cx123456789/embed",
    source: "instagram",
    uploader: { name: "Elijah Cole", email: "elijah.cole@example.com" },
    createdAt: new Date().toISOString(),
    viewCount: 12104,
    isTopRated: true,
  },
  {
    id: "vid-29",
    title: "Concept Car Reveal",
    description: "Text-to-video exploration of futuristic automotive lines.",
    url: "https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4",
    source: "external",
    uploader: { name: "Noor Vega", email: "noor.vega@example.com" },
    createdAt: new Date().toISOString(),
    viewCount: 8541,
    isTopRated: false,
  },
  {
    id: "vid-30",
    title: "Neon Skyline",
    url: "https://www.youtube.com/embed/aqz-KE-bpKQ",
    source: "youtube",
    uploader: { name: "Kira Holt", email: "kira.holt@example.com" },
    createdAt: new Date().toISOString(),
    viewCount: 15309,
    isTopRated: true,
  },
  {
    id: "vid-31",
    title: "AI Painter Study",
    description: "Time-lapse of an AI assistant reimagining still photography.",
    url: "https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4",
    source: "external",
    uploader: { name: "Roman Bell", email: "roman.bell@example.com" },
    createdAt: new Date().toISOString(),
    viewCount: 6542,
    isTopRated: false,
  },
  {
    id: "vid-32",
    title: "Robotic Choreography",
    description: "Procedurally generated dance loops synced to music.",
    url: "https://www.youtube.com/embed/lTTajzrSkCw",
    source: "youtube",
    uploader: { name: "Iris Navarre", email: "iris.navarre@example.com" },
    createdAt: new Date().toISOString(),
    viewCount: 9978,
    isTopRated: false,
  },
  {
    id: "vid-33",
    url: "https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4",
    source: "external",
    uploader: { name: "Theo Marsh", email: "theo.marsh@example.com" },
    createdAt: new Date().toISOString(),
    viewCount: 4412,
    isTopRated: false,
  },
  {
    id: "vid-34",
    title: "AI Storyboards",
    description: "Generated stills sequenced into a motion storyboard.",
    url: "https://www.youtube.com/embed/w86L6_0hN0E",
    source: "youtube",
    uploader: { name: "Lena Ortiz", email: "lena.ortiz@example.com" },
    createdAt: new Date().toISOString(),
    viewCount: 11221,
    isTopRated: false,
  },
  {
    id: "vid-35",
    description: "Testing stability of diffusion-based motion models.",
    url: "https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4",
    source: "external",
    uploader: { name: "Zara Finn", email: "zara.finn@example.com" },
    createdAt: new Date().toISOString(),
    viewCount: 5230,
    isTopRated: false,
  },
];

const ADMIN_EMAIL = "mbamoveteam@gmail.com";

export default function Home() {
  const [videos, setVideos] = useState<Video[]>(initialVideos);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [authPrompt, setAuthPrompt] = useState(false);
  const objectUrls = useRef<Set<string>>(new Set());

  useEffect(() => {
    const urls = objectUrls.current;

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const isAuthenticated = Boolean(user);
  const isAdmin = user?.email === ADMIN_EMAIL;

  const handleGoogleSignIn = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.open(
      "https://accounts.google.com/signin/v2/identifier",
      "_blank",
      "noopener,noreferrer"
    );

    const emailFromUser = window.prompt(
      "Enter your Google email to complete sign-in:"
    );

    if (!emailFromUser) {
      return;
    }

    const trimmedEmail = emailFromUser.trim();

    if (!trimmedEmail) {
      return;
    }

    const nameFromEmail =
      trimmedEmail
        .split("@")[0]
        ?.replace(/[._-]/g, " ")
        .trim() || "Creator";

    setUser({
      email: trimmedEmail,
      name: toTitleCase(nameFromEmail),
    });
  }, []);

  const handleGoogleSignOut = useCallback(() => {
    setUser(null);
    setSelectedVideo(null);
  }, []);

  const requireAuthentication = useCallback(() => {
    if (!isAuthenticated) {
      setAuthPrompt(true);
      return false;
    }

    return true;
  }, [isAuthenticated]);

  const handleUploadSubmit = useCallback(
    (payload: UploadPayload) => {
      if (!user || (!payload.videoFile && !payload.videoLink)) {
        return;
      }

      const nextVideos = [...videos];
      const now = new Date().toISOString();

      if (payload.videoFile) {
        const objectUrl = URL.createObjectURL(payload.videoFile);
        objectUrls.current.add(objectUrl);

        nextVideos.unshift({
          id: `upload-${Date.now()}`,
          title: payload.title || undefined,
          description: payload.description || undefined,
          url: objectUrl,
          source: "file",
          uploader: {
            name: user.name,
            email: user.email,
          },
          createdAt: now,
          viewCount: 0,
          isTopRated: false,
        });
      } else if (payload.videoLink) {
        const { url, source } = normaliseLink(payload.videoLink);

        nextVideos.unshift({
          id: `link-${Date.now()}`,
          title: payload.title || undefined,
          description: payload.description || undefined,
          url,
          source,
          uploader: {
            name: user.name,
            email: user.email,
          },
          createdAt: now,
          viewCount: 0,
          isTopRated: false,
        });
      }

      setVideos(nextVideos);
      setShowUploadForm(false);
    },
    [user, videos]
  );

  const videosToDisplay = useMemo(() => videos, [videos]);
  const topRatedVideos = useMemo(
    () => videos.filter((video) => video.isTopRated),
    [videos]
  );

  const handleToggleTopRated = useCallback((videoId: string) => {
    setVideos((previousVideos) => {
      const updatedVideos = previousVideos.map((video) =>
        video.id === videoId ? { ...video, isTopRated: !video.isTopRated } : video
      );
      const refreshedSelection =
        updatedVideos.find((video) => video.id === videoId) ?? null;

      setSelectedVideo((current) =>
        current?.id === videoId ? refreshedSelection : current
      );

      return updatedVideos;
    });
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <header className="flex items-start justify-between px-10 py-10">
        <div>
          <span className="block text-xs uppercase tracking-[0.6em] text-neutral-500">
            A Home For
          </span>
          <h1 className="mt-4 text-5xl font-semibold tracking-wide">AI Videos</h1>
          <p className="mt-3 text-sm text-neutral-400">
            Highlighting AI video creators in one tool-agnostic place
          </p>
        </div>

        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg font-medium uppercase">
                {user.name.charAt(0)}
              </div>
              <button
                type="button"
                onClick={handleGoogleSignOut}
                className="rounded-full border border-white/20 px-5 py-2 text-sm font-medium tracking-wide transition hover:bg-white hover:text-black"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="flex size-12 items-center justify-center rounded-full border border-white/20 transition hover:border-white"
              aria-label="Sign in with Google"
            >
              <GoogleIcon />
            </button>
          )}
        </div>
      </header>
      <div className="flex justify-center">
          <button
            type="button"
            onClick={() => {
              if (requireAuthentication()) {
                setShowUploadForm(true);
              }
            }}
            className="mb-12 inline-flex items-center rounded-full bg-blue-500 px-8 py-4 text-sm font-semibold tracking-wide text-white shadow-lg shadow-blue-500/40 transition hover:bg-blue-400"
          >
            Upload Your AI Videos
          </button>
        </div>

      <main className="flex-1 px-10 pb-16">
        <section className="mb-12">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xs uppercase tracking-[0.6em] text-neutral-500">
                Top Rated
              </h2>
            </div>
            {isAdmin ? (
              <p className="text-xs text-neutral-500">
                Select a video to feature or remove it from Top Rated.
              </p>
            ) : null}
          </div>
          {topRatedVideos.length > 0 ? (
            <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {topRatedVideos.map((video) => (
                <VideoCard
                  key={`top-${video.id}`}
                  video={video}
                  isActive={selectedVideo?.id === video.id}
                  onSelect={() => setSelectedVideo(video)}
                />
              ))}
            </div>
          ) : (
            <p className="mt-6 text-sm text-neutral-500">
              No videos have been featured yet. Admins can promote favorites from
              the video details panel.
            </p>
          )}
        </section>
        <section className="flex h-[calc(100vh-240px)] gap-8">
          <div className="flex-1 overflow-hidden">
            <div className="grid h-full grid-cols-1 gap-6 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
              {videosToDisplay.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  isActive={selectedVideo?.id === video.id}
                  onSelect={() => setSelectedVideo(video)}
                />
              ))}
            </div>
          </div>

          {selectedVideo ? (
            <aside className="hidden w-full max-w-sm flex-col rounded-3xl border border-white/10 bg-white/[0.06] px-8 py-10 backdrop-blur md:flex">
              <span className="text-xs uppercase tracking-[0.4em] text-neutral-500">
                uploaded by
              </span>
              <h2 className="mt-6 text-3xl font-semibold tracking-wide">
                {selectedVideo.uploader.name}
              </h2>
              <p className="mt-2 text-sm text-neutral-300">
                {selectedVideo.uploader.email}
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.3em] text-neutral-500">
                {selectedVideo.viewCount.toLocaleString()} views
              </p>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => handleToggleTopRated(selectedVideo.id)}
                  className={`mt-6 rounded-full border px-5 py-2 text-xs font-semibold tracking-wide transition ${
                    selectedVideo.isTopRated
                      ? "border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
                      : "border-white/20 text-neutral-300 hover:border-blue-500 hover:text-white"
                  }`}
                >
                  {selectedVideo.isTopRated
                    ? "Remove from Top Rated"
                    : "Feature in Top Rated"}
                </button>
              ) : null}
              {selectedVideo.title ? (
                <div className="mt-8">
                  <h3 className="text-lg font-medium">{selectedVideo.title}</h3>
                  {selectedVideo.description ? (
                    <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                      {selectedVideo.description}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <p className="mt-auto text-xs uppercase tracking-[0.3em] text-neutral-500">
                {new Date(selectedVideo.createdAt).toLocaleDateString()}
              </p>
            </aside>
          ) : (
            <aside className="hidden w-full max-w-sm flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.04] text-neutral-500 md:flex">
              <p className="px-12 text-center text-sm leading-relaxed">
                Select any video tile to see who created it and the story behind
                the upload.
              </p>
            </aside>
          )}
        </section>
      </main>

      {showUploadForm && user ? (
        <UploadModal
          onClose={() => setShowUploadForm(false)}
          onSubmit={handleUploadSubmit}
          user={user}
        />
      ) : null}

      {authPrompt ? (
        <PromptDialog
          onDismiss={() => setAuthPrompt(false)}
          onConfirm={handleGoogleSignIn}
        />
      ) : null}
    </div>
  );
}

function UploadModal({
  onClose,
  onSubmit,
  user,
}: {
  onClose: () => void;
  onSubmit: (payload: UploadPayload) => void;
  user: User;
}) {
  const [formState, setFormState] = useState<UploadPayload>({
    title: "",
    description: "",
    videoLink: "",
    videoFile: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [hasAgreed, setHasAgreed] = useState(false);

  const handleClose = () => {
    setHasAgreed(false);
    setError(null);
    onClose();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formState.videoFile && !formState.videoLink.trim()) {
      setError("Choose a video file or provide a trusted link.");
      return;
    }

    if (!hasAgreed) {
      setError(
        "Please acknowledge the redistribution statement before uploading."
      );
      return;
    }

    setError(null);
    onSubmit({
      ...formState,
      videoLink: formState.videoLink.trim(),
    });
    setFormState({
      title: "",
      description: "",
      videoLink: "",
      videoFile: null,
    });
    setHasAgreed(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-black px-10 py-12 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-wide">
              Upload Your AI Video
            </h2>
            <p className="mt-2 text-sm text-neutral-400">Signed in as {user.email}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border border-white/10 p-2 text-sm text-neutral-400 transition hover:border-white hover:text-white"
            aria-label="Close upload form"
          >
            ✕
          </button>
        </div>

        <form className="mt-10 space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              Optional title
              <input
                value={formState.title}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    title: event.target.value,
                  }))
                }
                placeholder="Give your video a name"
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                maxLength={80}
              />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              Optional description
              <input
                value={formState.description}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                placeholder="Share how you created it"
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                maxLength={120}
              />
            </label>
          </div>

          <label className="flex flex-col gap-3 text-sm">
            Video link (YouTube, Instagram, or direct file URL)
            <input
              value={formState.videoLink}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  videoLink: event.target.value,
                }))
              }
              placeholder="https://www.youtube.com/watch?v=..."
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none transition focus:border-blue-500"
            />
          </label>

          <div className="flex items-center gap-4">
            <span className="text-sm text-neutral-500">or</span>
            <label className="flex w-full flex-col gap-3 text-sm">
              Upload a video file
              <input
                type="file"
                accept="video/*"
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    videoFile: event.target.files?.[0] ?? null,
                  }))
                }
                className="cursor-pointer rounded-xl border border-dashed border-white/20 bg-white/[0.02] px-4 py-10 text-center text-neutral-400 transition hover:border-white"
              />
            </label>
          </div>

          <label className="flex items-start gap-3 text-xs text-neutral-400">
            <input
              type="checkbox"
              checked={hasAgreed}
              onChange={(event) => setHasAgreed(event.target.checked)}
              className="mt-1 size-4 cursor-pointer rounded border border-white/20 bg-white/[0.02]"
            />
            <span>
              By uploading to this site, I acknowledge that AI Videos may
              republish and credit my work on social media, but does not claim
              ownership or copyright of my video.
            </span>
          </label>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <div className="flex justify-end gap-4 text-sm">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full border border-white/10 px-6 py-3 transition hover:border-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!hasAgreed}
              className="rounded-full bg-blue-500 px-6 py-3 font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-blue-500"
            >
              Share video
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function VideoCard({
  video,
  isActive,
  onSelect,
}: {
  video: Video;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <article
      className={`flex cursor-pointer flex-col rounded-3xl border ${
        isActive ? "border-blue-500" : "border-white/10"
      } bg-white/[0.04] p-5 transition hover:border-blue-500`}
      onClick={onSelect}
    >
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
        {video.source === "youtube" || video.source === "instagram" ? (
          <iframe
            src={video.url}
            title={video.title ?? "Embedded video"}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video controls playsInline className="h-full w-full" src={video.url} />
        )}
      </div>
      <div className="mt-4">
        {video.isTopRated ? (
          <span className="text-[10px] uppercase tracking-[0.4em] text-blue-400">
            Top Rated
          </span>
        ) : null}
        <p
          className={`text-xs uppercase tracking-[0.3em] text-neutral-500${
            video.isTopRated ? " mt-3" : ""
          }`}
        >
          {video.uploader.name}
        </p>
        {video.title ? (
          <h3 className="mt-2 text-lg font-medium">{video.title}</h3>
        ) : (
          <h3 className="mt-2 text-lg font-medium text-neutral-400">Untitled Upload</h3>
        )}
      </div>
    </article>
  );
}

function PromptDialog({
  onDismiss,
  onConfirm,
}: {
  onDismiss: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-black px-8 py-10 text-center">
        <h3 className="text-xl font-semibold tracking-wide">Sign in required</h3>
        <p className="mt-3 text-sm text-neutral-400">
          You need to sign in with Google before you can upload your AI videos.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full border border-white/10 px-6 py-3 transition hover:border-white"
          >
            Maybe later
          </button>
          <button
            type="button"
            onClick={() => {
              onDismiss();
              onConfirm();
            }}
            className="inline-flex items-center gap-2 rounded-full bg-blue-500 px-6 py-3 font-semibold text-white transition hover:bg-blue-400"
          >
            <GoogleIcon small />
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon({ small = false }: { small?: boolean }) {
  const sizeClass = small ? "size-5" : "size-6";

  return (
    <svg
      className={sizeClass}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M21.6 12.2273C21.6 11.4364 21.5273 10.8727 21.3691 10.2909H12V13.8727H17.4218C17.3127 14.7545 16.7273 16.1182 15.3782 17.0636L15.3591 17.1891L18.4536 19.5136L18.6682 19.5364C20.6227 17.7818 21.6 15.2545 21.6 12.2273Z"
        fill="#4285F4"
      />
      <path
        d="M11.9999 21.6C14.759 21.6 17.0817 20.6909 18.6681 19.5364L15.3781 17.0636C14.5672 17.6182 13.4636 18.0091 11.9999 18.0091C9.30445 18.0091 7.01808 16.2545 6.19999 13.8545L6.0809 13.8645L2.86717 16.2818L2.82446 16.3909C4.39717 19.6636 7.91808 21.6 11.9999 21.6Z"
        fill="#34A853"
      />
      <path
        d="M6.2 13.8545C5.98364 13.2727 5.85636 12.6454 5.85636 12C5.85636 11.3545 5.98364 10.7273 6.18909 10.1455L6.18364 10.0127L2.93273 7.55908L2.82455 7.60908C2.11273 9.01817 1.70909 10.4636 1.70909 12C1.70909 13.5363 2.11273 14.9818 2.82455 16.3909L6.2 13.8545Z"
        fill="#FBBC05"
      />
      <path
        d="M11.9999 5.99089C13.799 5.99089 15.0145 6.76544 15.7045 7.41817L18.7317 4.58181C17.0708 3.00908 14.759 2 11.9999 2C7.91808 2 4.39717 3.93635 2.82446 7.20908L6.189 10.1454C7.01808 7.74536 9.30445 5.99089 11.9999 5.99089Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function normaliseLink(input: string): { url: string; source: VideoSource } {
  try {
    const url = new URL(input);

    if (url.hostname.includes("youtube.com") || url.hostname === "youtu.be") {
      const id =
        url.searchParams.get("v") ||
        url.pathname
          .split("/")
          .filter(Boolean)
          .pop();

      if (id) {
        return {
          url: `https://www.youtube.com/embed/${id}`,
          source: "youtube",
        };
      }
    }

    if (url.hostname.includes("instagram.com")) {
      return {
        url: `${url.origin}${url.pathname.replace(/\/$/, "")}/embed`,
        source: "instagram",
      };
    }

    return { url: input, source: "external" };
  } catch {
    return { url: input, source: "external" };
  }
}

function toTitleCase(input: string) {
  return input
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
