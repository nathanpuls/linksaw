// Detection and destination rules are adapted from QK.rs at commit 29f92da.
// Matches remain slices of the original string so rendering never rewrites a
// snippet's visible whitespace, punctuation, line breaks, or unit formatting.
const EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PROTOCOL_URL = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const PLAIN_URL = /\b(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|(?:[a-z0-9-]+\.)+[a-z]{2,})(?::\d+)?(?:\/[\w?&#.\-]*)?(?=\s|$|[),;:!?])/gi;
const HIGHWAY_ADDRESS = /\b\d{1,5}[ \t]+(?:US|I|SR|Rte|Route)[ \t-]*\d{1,5}(?:(?:[ \t]*,[ \t]*(?:\r?\n)?|[ \t]*\r?\n[ \t]*)[A-Za-z0-9][A-Za-z0-9 \t.\-]{0,80}){0,3}/gi;
const STREET_ADDRESS = /\b\d{1,5}[ \t]+[A-Za-z0-9][A-Za-z0-9.\-]*(?:[ \t]+(?!Unit\b|Apt\b|Suite\b|Ste\b|#\b|Floor\b|Fl\b)[A-Za-z0-9.\-]+){0,6}[ \t]+(?:St(?:reet)?|Ave(?:nue)?|Rd(?:oad)?|Blvd|Boulevard|Ln|Lane|Dr|Drive|Ct|Court|Cir|Circle|Hwy|Highway|Pkwy|Way|Terrace|Ter|Pl|Place|(?:US|I|SR|Rte|Route)[ \t-]*\d{1,5}|[A-Za-z]{2,6}-\d{1,5})(?:[ \t]+(?:Unit|Apt|Suite|Ste|#|Floor|Fl)\b[^\r\n,]{0,40})?(?:(?:[ \t]*,[ \t]*(?:\r?\n)?|[ \t]*\r?\n[ \t]*)[A-Za-z0-9][A-Za-z0-9 \t.\-]{0,60}){0,3}/gi;
const PHONE = /(?:\+|00)\d[\d \t\-().]{7,}\d|\(?\d{3}\)?[ \t\-.]\d{3}[ \t\-.]\d{4}/g;

function normalizedUrl(value) {
  const destination = value.replace(/[.,;:!?)}\]]+$/g, "");
  return /^https?:\/\//i.test(destination) ? destination : `http://${destination}`;
}

function normalizedAddress(value) {
  return value
    .replace(/\r?\n/g, " ")
    .replace(/(\b(?:Unit|Apt|Suite|Ste|#|Floor|Fl)\b[^,]*),[ \t]*/gi, "$1 ")
    .replace(/[\s,.;:!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function candidates(text) {
  const found = [];
  const add = (pattern, type, priority, destination) => {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const value = match[0];
      if (type === "url" && (text[match.index - 1] === "`" || text[match.index + value.length] === "`")) continue;
      found.push({ start: match.index, end: match.index + value.length, text: value, type, priority, href: destination(value) });
    }
  };
  add(EMAIL, "email", 0, value => `mailto:${value}`);
  add(PROTOCOL_URL, "url", 1, normalizedUrl);
  add(PLAIN_URL, "url", 1, normalizedUrl);
  add(HIGHWAY_ADDRESS, "address", 2, value => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(normalizedAddress(value))}`);
  add(STREET_ADDRESS, "address", 2, value => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(normalizedAddress(value))}`);
  add(PHONE, "phone", 3, value => `tel:${value.replace(/[^\d+]/g, "")}`);
  return found.sort((a, b) => a.start - b.start || a.priority - b.priority || b.end - a.end);
}

export function linkifyText(value) {
  const text = String(value ?? "");
  const parts = [];
  let cursor = 0;
  for (const match of candidates(text)) {
    if (match.start < cursor || !match.href) continue;
    if (match.start > cursor) parts.push({ text: text.slice(cursor, match.start) });
    parts.push({
      text: text.slice(match.start, match.end),
      href: match.href,
      type: match.type,
      external: match.type === "url" || match.type === "address",
    });
    cursor = match.end;
  }
  if (cursor < text.length || !parts.length) parts.push({ text: text.slice(cursor) });
  return parts;
}
