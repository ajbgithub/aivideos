import type { Metadata } from "next";

import VideoPageClient from "./VideoPageClient";
import { getVideoByIdServer } from "@/lib/getVideoByIdServer";
import { getSiteUrl } from "@/lib/getSiteUrl";

type VideoPageParams = {
  id: string;
};

export async function generateMetadata({
  params,
}: {
  params: VideoPageParams;
}): Promise<Metadata> {
  const videoId = Array.isArray(params.id) ? params.id[0] : params.id;
  const video = videoId ? await getVideoByIdServer(videoId) : null;
  const baseUrl = getSiteUrl().replace(/\/$/, "");
  const canonicalUrl = `${baseUrl}/video/${encodeURIComponent(videoId)}`;
  const ogImageUrl = `${canonicalUrl}/opengraph-image`;

  const fallbackTitle = "Video | Eagle AI Pictures";
  const fallbackDescription =
    "Watch AI-powered stories and creator showcases on Eagle AI Pictures.";

  if (!video) {
    return {
      title: fallbackTitle,
      description: fallbackDescription,
      alternates: {
        canonical: canonicalUrl,
      },
      openGraph: {
        title: fallbackTitle,
        description: fallbackDescription,
        url: canonicalUrl,
        siteName: "Eagle AI Pictures",
        images: [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: fallbackTitle,
        description: fallbackDescription,
        images: [ogImageUrl],
      },
    };
  }

  const displayTitle = video.title?.trim() || "Untitled Upload";
  const displayDescription =
    video.description?.trim() ||
    `Explore ${displayTitle} from ${video.fullName ?? video.uploader.name}.`;

  return {
    title: `${displayTitle} · Eagle AI Pictures`,
    description: displayDescription,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: displayTitle,
      description: displayDescription,
      url: canonicalUrl,
      siteName: "Eagle AI Pictures",
      type: "video.other",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: displayTitle,
      description: displayDescription,
      images: [ogImageUrl],
    },
  };
}

export default function VideoPage({
  params,
}: {
  params: VideoPageParams;
}) {
  const videoId = Array.isArray(params.id) ? params.id[0] : params.id;

  return <VideoPageClient videoId={videoId} />;
}
