import { linkifyText } from "./linkify.js";

// Linksaw stores Markdown as plain text. This renderer deliberately supports a
// small, useful Markdown subset and escapes everything else. Because raw HTML
// is never passed through, snippets cannot create scripts, event handlers, or
// arbitrary elements in the viewer.
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapedText(value, breaks = true) {
  const escaped = escapeHtml(value);
  return breaks ? escaped.replace(/\r?\n/g, "<br>") : escaped;
}

function safeHref(value) {
  const href = String(value ?? "").trim().replace(/^<|>$/g, "");
  return /^(?:https?:|mailto:|tel:)/i.test(href) ? href : "";
}

function linkedPlainText(value) {
  return linkifyText(value).map(part => {
    const label = escapedText(part.text);
    if (!part.href) return label;
    const href = safeHref(part.href);
    if (!href) return label;
    const external = part.external ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${escapeHtml(href)}"${external}>${label}</a>`;
  }).join("");
}

function renderInline(value, depth = 0) {
  const source = String(value ?? "");
  if (!source || depth > 8) return linkedPlainText(source);
  const token = /(`+)([^`\n]+?)\1|\[([^\]\n]+)\]\(([^)\n]+)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|_([^_\n]+)_/g;
  let output = "";
  let cursor = 0;
  for (const match of source.matchAll(token)) {
    if (match.index > cursor) output += linkedPlainText(source.slice(cursor, match.index));
    if (match[1]) {
      output += `<code>${escapeHtml(match[2])}</code>`;
    } else if (match[3] !== undefined) {
      const href = safeHref(match[4]);
      const label = renderInline(match[3], depth + 1);
      const external = /^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : "";
      output += href ? `<a href="${escapeHtml(href)}"${external}>${label}</a>` : label;
    } else if (match[5] !== undefined || match[6] !== undefined) {
      output += `<strong>${renderInline(match[5] ?? match[6], depth + 1)}</strong>`;
    } else {
      output += `<em>${renderInline(match[7] ?? match[8], depth + 1)}</em>`;
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < source.length) output += linkedPlainText(source.slice(cursor));
  return output;
}

function blockStart(line) {
  return /^(?: {0,3}(?:#{1,6}\s+|>|```|~~~|[-+*]\s+|\d+[.)]\s+)|\s*$)/.test(line);
}

export function markdownToSafeHtml(value) {
  const source = String(value ?? "");
  if (!source) return "";
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    const fence = line.match(/^ {0,3}(`{3,}|~{3,})[^\n]*$/);
    if (fence) {
      const marker = fence[1][0];
      const minimum = fence[1].length;
      const code = [];
      index += 1;
      while (index < lines.length && !new RegExp(`^ {0,3}${marker}{${minimum},}\\s*$`).test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(`<pre><code>${escapedText(code.join("\n"), false)}</code></pre>`);
      continue;
    }

    const heading = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      blocks.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^ {0,3}>/.test(line)) {
      const quote = [];
      while (index < lines.length && /^ {0,3}>/.test(lines[index])) {
        quote.push(lines[index].replace(/^ {0,3}> ?/, ""));
        index += 1;
      }
      blocks.push(`<blockquote>${markdownToSafeHtml(quote.join("\n"))}</blockquote>`);
      continue;
    }

    const unordered = line.match(/^ {0,3}[-+*]\s+(.+)$/);
    const ordered = line.match(/^ {0,3}\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const orderedList = Boolean(ordered);
      const matcher = orderedList ? /^ {0,3}\d+[.)]\s+(.+)$/ : /^ {0,3}[-+*]\s+(.+)$/;
      const items = [];
      while (index < lines.length) {
        const item = lines[index].match(matcher);
        if (!item) break;
        items.push(`<li>${renderInline(item[1])}</li>`);
        index += 1;
      }
      const tag = orderedList ? "ol" : "ul";
      blocks.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length && !blockStart(lines[index])) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(`<p>${renderInline(paragraph.join("\n"))}</p>`);
  }

  return blocks.join("\n");
}

export function renderMarkdown(element, value) {
  element.innerHTML = markdownToSafeHtml(value);
}
