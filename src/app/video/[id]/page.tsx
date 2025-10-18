"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useParams, useRouter } from "next/navigation";

import {
  INITIAL_VIDEOS,
  type StoredVideo,
} from "@/data/initialVideos";
import { ShareIcon } from "@/components/icons/ShareIcon";
import { mapDatabaseVideo } from "@/lib/mapDatabaseVideo";
import { supabase } from "@/lib/supabaseClient";

type LoadState = "loading" | "loaded" | "not_found" | "error";

export default function VideoDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const videoId = useMemo(() => {
    const value = params?.id;
    return Array.isArray(value) ? value[0] : value;
  }, [params]);
  const [video, setVideo] = useState<StoredVideo | null>(null);
  const [status, setStatus] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const shareTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (shareTimeoutRef.current) {
        clearTimeout(shareTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!videoId) {
      setStatus("not_found");
      return;
    }

    const seedMatch = INITIAL_VIDEOS.find((item) => item.id === videoId);

    if (seedMatch) {
      setVideo(seedMatch);
      setStatus("loaded");
      return;
    }

    let isMounted = true;

    const loadVideo = async () => {
      setStatus("loading");
      setErrorMessage(null);

      const { data, error } = await supabase
        .from("videos")
        .select(
          "id, title, description, video_url, source, storage_object_path, categories, full_name, view_count, is_top_rated, uploader_name, uploader_email, created_at"
        )
        .eq("id", videoId)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (error) {
        setStatus("error");
        setErrorMessage(error.message);
        return;
      }

      const mapped = mapDatabaseVideo(data);

      if (!mapped) {
        setStatus("not_found");
        return;
      }

      setVideo(mapped);
      setStatus("loaded");
    };

    loadVideo();

    return () => {
      isMounted = false;
    };
  }, [videoId]);

  const handleShare = useCallback(async () => {
    if (typeof window === "undefined" || !video) {
      return;
    }

    const shareUrl = `${window.location.origin}/video/${encodeURIComponent(
      video.id
    )}`;
    const clipboardText = `Check out "${video.title ?? "this AI video"}" on aihomestudios: ${shareUrl}`;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(clipboardText);
        setShareNotice("Link copied!");
        if (shareTimeoutRef.current) {
          clearTimeout(shareTimeoutRef.current);
        }
        shareTimeoutRef.current = setTimeout(() => {
          setShareNotice(null);
          shareTimeoutRef.current = null;
        }, 2000);
      } else {
        throw new Error("Clipboard unavailable");
      }
    } catch {
      window.prompt("Copy this link and share it:", shareUrl);
    }
  }, [video]);

  if (status === "loading") {
    return (
      <PageShell>
        <StatusMessage>Loading video…</StatusMessage>
      </PageShell>
    );
  }

  if (status === "error") {
    return (
      <PageShell>
        <StatusMessage>
          Unable to load this video. {errorMessage ?? "Please try again later."}
        </StatusMessage>
        <BackLink onNavigate={() => router.push("/")}>
          Return to gallery
        </BackLink>
      </PageShell>
    );
  }

  if (status === "not_found" || !video) {
    return (
      <PageShell>
        <StatusMessage>
          We couldn&apos;t find that video. It may have been removed.
        </StatusMessage>
        <BackLink onNavigate={() => router.push("/")}>
          Return to gallery
        </BackLink>
      </PageShell>
    );
  }

  return (
    <PageShell>
      {shareNotice ? (
        <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center px-4">
          <div className="pointer-events-auto rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-medium text-white shadow-lg backdrop-blur">
            {shareNotice}
          </div>
        </div>
      ) : null}
      <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="inline-flex items-center text-xs uppercase tracking-[0.6em] text-neutral-500 transition hover:text-white"
          >
            Back to Gallery
          </button>
          <h1 className="mt-4 text-3xl font-semibold tracking-wide text-white sm:text-4xl">
            {video.title ?? "Untitled Upload"}
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Shared by {video.fullName ?? toTitleCase(video.uploader.name)}
          </p>
          {video.uploader.email ? (
            <p className="text-xs text-neutral-500">{video.uploader.email}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white hover:bg-white/10"
        >
          <ShareIcon />
          Share
        </button>
      </header>
      <main className="mt-10 grid gap-10 lg:grid-cols-[2fr,1fr] lg:items-start">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-black">
          <VideoPlayer video={video} />
        </div>
        <aside className="space-y-6 rounded-3xl border border-white/10 bg-white/[0.05] p-8 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-neutral-500">
              Categories
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {video.categories.length > 0 ? (
                video.categories.map((category) => (
                  <span
                    key={`${video.id}-${category}`}
                    className="inline-flex items-center rounded-full border border-white/10 px-4 py-1 text-[10px] uppercase tracking-[0.4em] text-neutral-300"
                  >
                    {category}
                  </span>
                ))
              ) : (
                <span className="text-xs text-neutral-500">
                  No categories provided.
                </span>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-neutral-500">
              Posted
            </p>
            <p className="mt-3 text-sm text-neutral-300">
              {new Date(video.createdAt).toLocaleString()}
            </p>
          </div>
          {video.description ? (
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-neutral-500">
                Description
              </p>
              <p className="mt-3 text-sm leading-relaxed text-neutral-300">
                {video.description}
              </p>
            </div>
          ) : null}
        </aside>
      </main>
    </PageShell>
  );
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-black px-6 pb-16 pt-12 text-white sm:px-12">
      <div className="mx-auto w-full max-w-5xl">{children}</div>
    </div>
  );
}

function StatusMessage({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-12 text-center text-sm text-neutral-300">
      {children}
    </div>
  );
}

function BackLink({
  onNavigate,
  children,
}: {
  onNavigate: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onNavigate}
      className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white hover:bg-white/10"
    >
      {children}
    </button>
  );
}

function VideoPlayer({ video }: { video: StoredVideo }) {
  if (video.source === "youtube" || video.source === "instagram") {
    return (
      <iframe
        src={video.url}
        title={video.title ?? "Embedded video"}
        className="aspect-video w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  if (video.source === "tiktok") {
    return (
      <iframe
        src={video.url}
        title={video.title ?? "TikTok video"}
        className="aspect-video w-full"
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return (
    <video
      controls
      playsInline
      preload="metadata"
      className="aspect-video w-full"
      src={video.url}
      controlsList="nodownload nofullscreen noremoteplayback"
      disablePictureInPicture
      onContextMenu={(event) => event.preventDefault()}
      draggable={false}
    />
  );
}

function toTitleCase(input: string) {
  return input
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
