export function getSiteUrl(): string {
  const direct =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_SITE_URL ||
    process.env.SITE_URL;

  if (direct) {
    return direct;
  }

  const vercelUrl = process.env.VERCEL_URL;

  if (vercelUrl) {
    return vercelUrl.startsWith("http")
      ? vercelUrl
      : `https://${vercelUrl}`;
  }

  return "http://localhost:3000";
}
