export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg"]);

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "::1" || host.endsWith(".local")) return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true;
  const match = host.match(/^172\.(\d+)\./);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return true;
  if (/^169\.254\./.test(host) || /^0\./.test(host)) return true;
  return false;
}

function parsePublicUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Enter a public logo URL.");
  const url = new URL(value.trim());
  if (!["http:", "https:"].includes(url.protocol) || isBlockedHost(url.hostname)) {
    throw new Error("Only public HTTP or HTTPS image URLs are supported.");
  }
  return url;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = parsePublicUrl(body?.url);
    const response = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      headers: { "User-Agent": "APEX-Meta-Reporting-Generator/1.0" },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) throw new Error("The logo URL returned HTTP " + response.status + ".");
    parsePublicUrl(response.url);

    const contentType = (response.headers.get("content-type") || "").split(";")[0].toLowerCase();
    if (!ALLOWED_TYPES.has(contentType)) throw new Error("The URL must point directly to a PNG or JPEG image.");

    const declaredSize = Number(response.headers.get("content-length") || 0);
    if (declaredSize > MAX_IMAGE_BYTES) throw new Error("The logo image must be 5 MB or smaller.");

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length) throw new Error("The logo URL returned an empty file.");
    if (bytes.length > MAX_IMAGE_BYTES) throw new Error("The logo image must be 5 MB or smaller.");

    const dataUrl = "data:" + contentType + ";base64," + Buffer.from(bytes).toString("base64");
    return Response.json({ success: true, dataUrl, contentType, size: bytes.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load that logo URL.";
    return Response.json({ success: false, error: message }, { status: 400 });
  }
}
