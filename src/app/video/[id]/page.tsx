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
  const [moreByCreator, setMoreByCreator] = useState<StoredVideo[]>([]);
  const shareTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRecordedViewRef = useRef(false);
  const viewFormatterRef = useRef(
    typeof window === "undefined"
      ? undefined
      : new Intl.NumberFormat("en-US")
  );
  const formattedViewCount = useMemo(() => {
    const formatter = viewFormatterRef.current;
    const safeCount = video?.viewCount ?? 0;
    if (formatter) {
      return formatter.format(safeCount);
    }
    return `${safeCount}`;
  }, [video?.viewCount]);

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
    const clipboardText = `Check out "${video.title ?? "this AI video"}" on Eagle AI Pictures: ${shareUrl}`;

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

  useEffect(() => {
    if (!video || hasRecordedViewRef.current) {
      return;
    }

    const isSeedVideo = Boolean(
      INITIAL_VIDEOS.find((item) => item.id === video.id)
    );

    if (isSeedVideo) {
      hasRecordedViewRef.current = true;
      return;
    }

    hasRecordedViewRef.current = true;

    const incrementView = async () => {
      const { data, error } = await supabase.rpc(
        "increment_video_view_count",
        { target_id: video.id }
      );

      if (!error) {
        const nextCount = typeof data === "number" ? data : video.viewCount + 1;
        setVideo((previous) =>
          previous ? { ...previous, viewCount: nextCount } : previous
        );
        return;
      }

      setVideo((previous) =>
        previous
          ? { ...previous, viewCount: previous.viewCount + 1 }
          : previous
      );
    };

    void incrementView();
  }, [video]);

  useEffect(() => {
    if (!video) {
      setMoreByCreator([]);
      return;
    }

    const related = new Map<string, StoredVideo>();

    const addVideo = (item: StoredVideo) => {
      if (item.id === video.id || related.has(item.id)) {
        return;
      }

      related.set(item.id, item);
    };

    const targetEmail = video.uploader.email?.trim();
    const targetName = (video.fullName ?? toTitleCase(video.uploader.name)).trim();

    INITIAL_VIDEOS.forEach((item) => {
      const itemEmail = item.uploader.email?.trim();
      const itemName = (item.fullName ?? toTitleCase(item.uploader.name)).trim();

      if (targetEmail && itemEmail) {
        if (itemEmail === targetEmail) {
          addVideo(item);
        }
        return;
      }

      if (!targetEmail && !itemEmail && itemName && itemName === targetName) {
        addVideo(item);
      }
    });

    let isMounted = true;

    const loadRelated = async () => {
      try {
        if (targetEmail) {
          const { data, error } = await supabase
            .from("videos")
            .select(
              "id, title, description, video_url, source, storage_object_path, categories, full_name, view_count, is_top_rated, uploader_name, uploader_email, created_at"
            )
            .eq("uploader_email", targetEmail)
            .neq("id", video.id)
            .order("created_at", { ascending: false })
            .limit(12);

          if (!error && data) {
            data
              .map(mapDatabaseVideo)
              .filter((item): item is StoredVideo => Boolean(item))
              .forEach(addVideo);
          }
        } else if (targetName) {
          const { data, error } = await supabase
            .from("videos")
            .select(
              "id, title, description, video_url, source, storage_object_path, categories, full_name, view_count, is_top_rated, uploader_name, uploader_email, created_at"
            )
            .eq("full_name", targetName)
            .neq("id", video.id)
            .order("created_at", { ascending: false })
            .limit(12);

          if (!error && data) {
            data
              .map(mapDatabaseVideo)
              .filter((item): item is StoredVideo => Boolean(item))
              .forEach(addVideo);
          }
        }
      } finally {
        if (isMounted) {
          setMoreByCreator(Array.from(related.values()).slice(0, 6));
        }
      }
    };

    loadRelated();

    return () => {
      isMounted = false;
    };
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
        <BackLink onNavigate={() => router.push("/")} />
      </PageShell>
    );
  }

  if (status === "not_found" || !video) {
    return (
      <PageShell>
        <StatusMessage>
          We couldn&apos;t find that video. It may have been removed.
        </StatusMessage>
        <BackLink onNavigate={() => router.push("/")} />
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
            className="inline-flex items-center justify-center rounded-full border border-white/20 p-3 text-white transition hover:border-white hover:bg-white/10"
            aria-label="Back to gallery"
          >
            ←
          </button>
          <h1 className="mt-4 text-3xl font-semibold tracking-wide text-white sm:text-4xl">
            {video.title ?? "Untitled Upload"}
          </h1>
          <p className="mt-2 text-sm text-white">
            Shared by {video.fullName ?? toTitleCase(video.uploader.name)}
          </p>
          {video.uploader.email ? (
            <p className="text-xs text-white">{video.uploader.email}</p>
          ) : null}
          <p className="mt-2 text-sm text-white/70">
            {formattedViewCount} {video.viewCount === 1 ? "view" : "views"}
          </p>
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
            <p className="text-xs uppercase tracking-[0.4em] text-white">
              Description
            </p>
            <p className="mt-3 text-sm leading-relaxed text-white">
              {video.description && video.description.trim().length > 0
                ? video.description
                : "The creator hasn’t shared details about this piece yet."}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-white">
              Categories
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {video.categories.length > 0 ? (
                video.categories.map((category) => (
                  <span
                    key={`${video.id}-${category}`}
                    className="inline-flex items-center rounded-full border border-white/10 px-4 py-1 text-[10px] uppercase tracking-[0.4em] text-white"
                  >
                    {category}
                  </span>
                ))
              ) : (
                <span className="text-xs text-white">
                  No categories provided.
                </span>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-white">
              Posted
            </p>
            <p className="mt-3 text-sm text-white">
              {new Date(video.createdAt).toLocaleString()}
            </p>
          </div>
        </aside>
      </main>
      {moreByCreator.length > 0 ? (
        <section className="mt-16">
          <h2 className="text-lg font-semibold text-white">
            More by this creator
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {moreByCreator.map((item) => (
              <RelatedVideoCard
                key={item.id}
                video={item}
                onOpen={() => router.push(`/video/${item.id}`)}
              />
            ))}
          </div>
        </section>
      ) : null}
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
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-12 text-center text-sm text-white">
      {children}
    </div>
  );
}

function BackLink({ onNavigate }: { onNavigate: () => void }) {
  return (
    <button
      type="button"
      onClick={onNavigate}
      className="mt-6 inline-flex items-center justify-center rounded-full border border-white/20 p-3 text-white transition hover:border-white hover:bg-white/10"
      aria-label="Back to gallery"
    >
      ←
    </button>
  );
}

function RelatedVideoCard({
  video,
  onOpen,
}: {
  video: StoredVideo;
  onOpen: () => void;
}) {
  const displayTitle = video.title ?? "Untitled Upload";
  const displayName = video.fullName ?? toTitleCase(video.uploader.name);
  const views = video.viewCount ?? 0;

  return (
    <article
      className="group flex cursor-pointer flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] transition hover:border-blue-500"
      onClick={onOpen}
    >
      <div className="flex aspect-video items-center justify-center bg-black/80 text-white">
        <span className="text-xs uppercase tracking-[0.4em]">View</span>
      </div>
      <div className="p-5">
        <h3 className="text-base font-semibold text-white group-hover:text-blue-200">
          {displayTitle}
        </h3>
        <p className="mt-1 text-xs text-white/70">
          {new Intl.NumberFormat("en-US").format(views)} {views === 1 ? "view" : "views"}
        </p>
        <p className="mt-2 text-xs uppercase tracking-[0.3em] text-white">
          {displayName}
        </p>
        {video.categories.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {video.categories.slice(0, 3).map((category) => (
              <span
                key={`${video.id}-more-${category}`}
                className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-white"
              >
                {category}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
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
