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

function sourceAttributes(start, end, atomic = false) {
  return ` data-source-start="${start}" data-source-end="${end}"${atomic ? ' data-source-atomic="true"' : ""}`;
}

function mappedPlainText(value, start) {
  const pieces = String(value ?? "").split("\n");
  let offset = start;
  return pieces.map((piece, index) => {
    const html = piece ? `<span${sourceAttributes(offset, offset + piece.length)}>${escapeHtml(piece)}</span>` : "";
    offset += piece.length;
    if (index === pieces.length - 1) return html;
    const lineBreak = `<br${sourceAttributes(offset, offset + 1)}>`;
    offset += 1;
    return `${html}${lineBreak}`;
  }).join("");
}

function linkedPlainText(value, baseOffset = 0) {
  let cursor = 0;
  return linkifyText(value).map(part => {
    const start = baseOffset + cursor;
    const end = start + part.text.length;
    cursor += part.text.length;
    if (!part.href) return mappedPlainText(part.text, start);
    const href = safeHref(part.href);
    if (!href) return mappedPlainText(part.text, start);
    const label = escapedText(part.text);
    const external = part.external ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${escapeHtml(href)}"${external}>${label}</a>`;
  }).join("");
}

function renderInline(value, depth = 0, baseOffset = 0) {
  const source = String(value ?? "");
  if (!source || depth > 8) return linkedPlainText(source, baseOffset);
  const token = /(`+)([^`\n]+?)\1|\[([^\]\n]+)\]\(([^)\n]+)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|_([^_\n]+)_/g;
  let output = "";
  let cursor = 0;
  for (const match of source.matchAll(token)) {
    if (match.index > cursor) output += linkedPlainText(source.slice(cursor, match.index), baseOffset + cursor);
    const start = baseOffset + match.index;
    const end = start + match[0].length;
    if (match[1]) {
      output += `<code${sourceAttributes(start, end, true)}>${escapeHtml(match[2])}</code>`;
    } else if (match[3] !== undefined) {
      const href = safeHref(match[4]);
      const label = renderInline(match[3], depth + 1, start + 1);
      const external = /^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : "";
      output += href ? `<a href="${escapeHtml(href)}"${external}${sourceAttributes(start, end, true)}>${label}</a>` : label;
    } else if (match[5] !== undefined || match[6] !== undefined) {
      output += `<strong${sourceAttributes(start, end, true)}>${renderInline(match[5] ?? match[6], depth + 1, start + 2)}</strong>`;
    } else {
      output += `<em${sourceAttributes(start, end, true)}>${renderInline(match[7] ?? match[8], depth + 1, start + 1)}</em>`;
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < source.length) output += linkedPlainText(source.slice(cursor), baseOffset + cursor);
  return output;
}

function blockStart(line) {
  return /^(?: {0,3}(?:#{1,6}\s+|>|```|~~~|[-+*]\s+|\d+[.)]\s+)|\s*$)/.test(line);
}

export function markdownToSafeHtml(value) {
  const source = String(value ?? "").replace(/\r\n?/g, "\n");
  if (!source) return "";
  const lines = source.split("\n");
  const lineStarts = [];
  let sourceCursor = 0;
  for (const line of lines) { lineStarts.push(sourceCursor); sourceCursor += line.length + 1; }
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    const fence = line.match(/^ {0,3}(`{3,}|~{3,})[^\n]*$/);
    if (fence) {
      const blockStartOffset = lineStarts[index];
      const marker = fence[1][0];
      const minimum = fence[1].length;
      const code = [];
      index += 1;
      while (index < lines.length && !new RegExp(`^ {0,3}${marker}{${minimum},}\\s*$`).test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      const blockEndOffset = index < lines.length ? lineStarts[index] - 1 : source.length;
      blocks.push(`<pre${sourceAttributes(blockStartOffset, blockEndOffset, true)}><code>${escapedText(code.join("\n"), false)}</code></pre>`);
      continue;
    }

    const heading = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      const start = lineStarts[index];
      blocks.push(`<h${level}${sourceAttributes(start, start + line.length, true)}>${renderInline(heading[2], 0, start + heading[0].indexOf(heading[2]))}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^ {0,3}>/.test(line)) {
      const quoteStart = lineStarts[index];
      const quote = [];
      while (index < lines.length && /^ {0,3}>/.test(lines[index])) {
        quote.push(lines[index].replace(/^ {0,3}> ?/, ""));
        index += 1;
      }
      const quoteEnd = index < lines.length ? lineStarts[index] - 1 : source.length;
      blocks.push(`<blockquote${sourceAttributes(quoteStart, quoteEnd, true)}>${markdownToSafeHtml(quote.join("\n"))}</blockquote>`);
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
        const start = lineStarts[index];
        items.push(`<li${sourceAttributes(start, start + lines[index].length, true)}>${renderInline(item[1], 0, start + item[0].indexOf(item[1]))}</li>`);
        index += 1;
      }
      const tag = orderedList ? "ol" : "ul";
      blocks.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }

    const paragraphStart = lineStarts[index];
    const paragraph = [line];
    index += 1;
    while (index < lines.length && !blockStart(lines[index])) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(`<p>${renderInline(paragraph.join("\n"), 0, paragraphStart)}</p>`);
  }

  return blocks.join("\n");
}

export function renderMarkdown(element, value) {
  element.innerHTML = markdownToSafeHtml(value);
}

export function sourceOffsetFromRenderedPoint(root, source, node, nodeOffset = 0, clientX = 0, clientY = 0) {
  const length = String(source ?? "").replace(/\r\n?/g, "\n").length;
  const element = node?.nodeType === 1 ? node : node?.parentElement;
  if (element && root.contains(element)) {
    const atomic = element.closest?.("[data-source-atomic]");
    if (atomic && root.contains(atomic)) {
      const rect = atomic.getBoundingClientRect();
      return clientX <= rect.left + rect.width / 2 ? Number(atomic.dataset.sourceStart) : Number(atomic.dataset.sourceEnd);
    }
    const mapped = element.closest?.("[data-source-start]");
    if (mapped && root.contains(mapped)) {
      const start = Number(mapped.dataset.sourceStart);
      const end = Number(mapped.dataset.sourceEnd);
      if (node?.nodeType === 3) return Math.max(start, Math.min(start + nodeOffset, end));
      const rect = mapped.getBoundingClientRect();
      return clientX <= rect.left + rect.width / 2 ? start : end;
    }
  }

  let nearest = null;
  let nearestDistance = Infinity;
  root.querySelectorAll("[data-source-start]").forEach(candidate => {
    const rect = candidate.getBoundingClientRect();
    const dx = clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0;
    const dy = clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;
    const distance = Math.hypot(dx, dy);
    if (distance < nearestDistance) { nearest = candidate; nearestDistance = distance; }
  });
  if (!nearest) return length;
  const rect = nearest.getBoundingClientRect();
  return clientX <= rect.left + rect.width / 2 ? Number(nearest.dataset.sourceStart) : Number(nearest.dataset.sourceEnd);
}
