export const nowSeconds = () => Math.floor(Date.now() / 1000);
export const randomToken = () => crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");

export function shareToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

export async function sha256Base64Url(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function validSnippet(input) {
  if (!input || typeof input !== "object") return null;
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const body = typeof input.body === "string" ? input.body : "";
  if (title.length > 160 || body.length > 100000 || (!title && !body.trim())) return null;
  return { title, body };
}

export function authUrl(clientId, redirectUri, state) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export function cookieValue(header, name) {
  if (!header) return "";
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return "";
}

export function webSessionCookie(token, maxAge = 30 * 86400) {
  return `linksaw_session=${token}; Max-Age=${maxAge}; Domain=linksaw.com; Path=/; HttpOnly; Secure; SameSite=Lax`;
}
