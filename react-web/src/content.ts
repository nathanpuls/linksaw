import type { Snippet } from "./types";
import { standaloneWebUrl } from "../../web/app/linkify.js";
import { markdownToSafeHtml } from "../../web/app/markdown.js";

export function derivedLabel(body: string) {
  return body.split(/\r?\n/).find(line => line.trim())?.trim().slice(0, 90) || "Untitled";
}
export function snippetLabel(snippet: Pick<Snippet, "title" | "body">) { return snippet.title.trim() || derivedLabel(snippet.body); }
export function snippetText(snippet: Pick<Snippet, "title" | "body">) { return snippet.body || snippet.title || ""; }
export function snippetUrl(snippet: Pick<Snippet, "title" | "body">) { return standaloneWebUrl(snippetText(snippet)); }
export function searchScore(snippet: Pick<Snippet, "title" | "body">, term: string) {
  const query = term.trim().toLocaleLowerCase();
  if (!query) return 0;
  const label = snippetLabel(snippet).toLocaleLowerCase();
  const title = snippet.title.toLocaleLowerCase();
  const body = snippet.body.toLocaleLowerCase();
  if (label === query) return 0;
  if (label.startsWith(query)) return 1;
  if (title.includes(query)) return 2;
  if (body.split(/\r?\n/).some(line => line.trimStart().startsWith(query))) return 3;
  if (body.includes(query)) return 4;
  return Number.POSITIVE_INFINITY;
}
export function searchExcerpt(body: string, term: string) {
  const query = term.trim().toLocaleLowerCase();
  if (!query) return body;
  const line = body.split(/\r?\n/).find(value => value.toLocaleLowerCase().includes(query));
  if (!line) return body;
  if (line.length <= 180) return line.trim();
  const index = line.toLocaleLowerCase().indexOf(query);
  const start = Math.max(0, index - 64); const end = Math.min(line.length, index + query.length + 96);
  return `${start ? "…" : ""}${line.slice(start, end).trim()}${end < line.length ? "…" : ""}`;
}
export function markdownHtml(source: string) { return { __html: markdownToSafeHtml(source) }; }
export function compactMarkdownHtml(source: string) {
  const html = markdownToSafeHtml(source)
    .replace(/<a\b[^>]*>/gi, '<span class="result-markdown-link">')
    .replace(/<\/a>/gi, "</span>");
  return { __html: html };
}
