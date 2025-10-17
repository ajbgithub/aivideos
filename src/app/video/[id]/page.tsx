import { INITIAL_VIDEOS, type StoredVideo } from "@/data/initialVideos";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

function videoToEmbed(video: StoredVideo) {
  if (video.source === "youtube" || video.source === "instagram" || video.source === "tiktok") {
    return (
      <iframe
        src={video.url}
        title={video.title ?? "Featured video"}
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return (
    <video
      controls
      playsInline
      preload="metadata"
      className="h-full w-full"
      src={video.url}
      controlsList="nodownload nofullscreen noremoteplayback"
      disablePictureInPicture
    />
  );
}

export function generateStaticParams() {
  return INITIAL_VIDEOS.map((video) => ({ id: video.id }));
}

type VideoPageProps = {
  params: { id: string };
};

export function generateMetadata({ params }: VideoPageProps): Metadata {
  const video = INITIAL_VIDEOS.find((item) => item.id === params.id);

  if (!video) {
    return {
      title: "AI Home Studios — Video Not Found",
      description:
        "The requested AI Home Studios video could not be located. Return to the gallery to explore more creator work.",
    };
  }

  return {
    title: `${video.title ?? "AI Home Studios Video"} | AI Home Studios`,
    description:
      video.description ??
      "Explore this AI-powered video experience, curated by AI Home Studios.",
  };
}

export default function VideoPage({ params }: VideoPageProps) {
  const video = INITIAL_VIDEOS.find((item) => item.id === params.id);

  if (!video) {
    notFound();
  }

  return (
    <main className="flex min-h-screen flex-col bg-black px-6 py-12 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-neutral-500">
              AI Home Studios
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-wide">
              {video.title ?? "Untitled Upload"}
            </h1>
            {video.description ? (
              <p className="mt-3 text-sm text-neutral-300">{video.description}</p>
            ) : null}
          </div>
          <Link
            href="/"
            className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white hover:bg-white/10"
          >
            ← Back to gallery
          </Link>
        </header>

        <section className="flex flex-col gap-8 lg:flex-row">
          <div className="aspect-video flex-1 overflow-hidden rounded-3xl border border-white/10 bg-black">
            {videoToEmbed(video)}
          </div>

          <aside className="flex w-full max-w-md flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.06] px-8 py-10 backdrop-blur">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-neutral-500">
                Uploaded by
              </p>
              <h2 className="mt-4 text-2xl font-semibold tracking-wide">
                {video.fullName ?? video.uploader.name}
              </h2>
              {video.uploader.email ? (
                <p className="mt-1 text-sm text-neutral-300">{video.uploader.email}</p>
              ) : null}
            </div>

            <div className="space-y-2 text-xs text-neutral-400">
              <p>Categories</p>
              <div className="flex flex-wrap gap-2">
                {video.categories.map((category) => (
                  <span
                    key={`${video.id}-${category}`}
                    className="inline-flex items-center rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.4em] text-neutral-300"
                  >
                    {category}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4 text-xs text-neutral-500">
              <p>View count: {video.viewCount.toLocaleString()}</p>
              <p className="mt-1">
                Consider a lightweight analytics layer (Supabase Edge Functions, Vercel
                Analytics, Plausible, etc.) to capture real engagement metrics.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
