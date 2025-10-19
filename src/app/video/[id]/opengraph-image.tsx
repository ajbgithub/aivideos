import { ImageResponse } from "next/og";

import { getVideoByIdServer } from "@/lib/getVideoByIdServer";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

const BACKGROUND_STYLE = {
  background:
    "linear-gradient(135deg, #060712 0%, #111439 55%, #06040e 100%)",
  color: "#ffffff",
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "space-between",
  padding: "64px 72px",
  position: "relative" as const,
};

function truncate(input: string, maxLength: number) {
  if (input.length <= maxLength) {
    return input;
  }

  return `${input.slice(0, maxLength - 1).trimEnd()}…`;
}

export default async function OpenGraphImage({
  params,
}: {
  params: { id: string };
}) {
  const videoId = Array.isArray(params.id) ? params.id[0] : params.id;
  const video = videoId ? await getVideoByIdServer(videoId) : null;

  const title = truncate(
    video?.title?.trim() || "Eagle AI Pictures",
    72
  );
  const creator = video?.fullName || video?.uploader?.name || "AI Creator";
  const categories = video?.categories?.slice(0, 3) ?? [];
  const subtitle =
    video?.description?.trim() ||
    `Discover new AI storytelling from ${creator}.`;

  return new ImageResponse(
    (
      <div style={BACKGROUND_STYLE}>
        <div
          style={{
            position: "absolute",
            inset: "-120px -80px auto auto",
            width: "540px",
            height: "540px",
            background:
              "radial-gradient(circle at 30% 30%, rgba(99,133,255,0.4), rgba(24,36,94,0.05) 68%)",
            filter: "blur(0px)",
          }}
        />
        <div
          style={{
            textTransform: "uppercase",
            letterSpacing: "0.5em",
            fontSize: "28px",
            fontWeight: 600,
            color: "rgba(255,255,255,0.72)",
          }}
        >
          Eagle AI Pictures
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "32px",
            maxWidth: "900px",
          }}
        >
          <div
            style={{
              fontSize: "70px",
              fontWeight: 700,
              lineHeight: 1.05,
              wordWrap: "break-word",
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "18px",
              alignItems: "center",
              color: "rgba(255,255,255,0.82)",
              fontSize: "32px",
            }}
          >
            <span style={{ fontWeight: 600 }}>By</span>
            <span style={{ fontWeight: 600 }}>{creator}</span>
          </div>
          <div
            style={{
              fontSize: "28px",
              color: "rgba(255,255,255,0.74)",
              lineHeight: 1.4,
              maxWidth: "900px",
            }}
          >
            {truncate(subtitle, 160)}
          </div>
          {categories.length > 0 ? (
            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
                marginTop: "8px",
              }}
            >
              {categories.map((category) => (
                <span
                  key={category}
                  style={{
                    borderRadius: "9999px",
                    border: "2px solid rgba(255,255,255,0.28)",
                    padding: "12px 24px",
                    fontSize: "22px",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.85)",
                  }}
                >
                  {category}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "rgba(255,255,255,0.7)",
            fontSize: "24px",
          }}
        >
          <span>Share bold AI stories.</span>
          {videoId ? (
            <span
              style={{
                fontSize: "20px",
                letterSpacing: "0.3em",
                textTransform: "uppercase",
              }}
            >
              #{videoId}
            </span>
          ) : null}
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
