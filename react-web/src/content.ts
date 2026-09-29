import type { Snippet } from "./types";
import { standaloneWebUrl } from "../../web/app/linkify.js";
import { markdownToSafeHtml } from "../../web/app/markdown.js";

export function derivedLabel(body: string) {
  return body.split(/\r?\n/).find(line => line.trim())?.trim().slice(0, 90) || "Untitled";
}
export function snippetLabel(snippet: Pick<Snippet, "title" | "body">) { return snippet.title.trim() || derivedLabel(snippet.body); }
export function snippetText(snippet: Pick<Snippet, "title" | "body">) { return snippet.body || snippet.title || ""; }
export function snippetUrl(snippet: Pick<Snippet, "title" | "body">) { return standaloneWebUrl(snippetText(snippet)); }
export function markdownHtml(source: string) { return { __html: markdownToSafeHtml(source) }; }
export function compactMarkdownHtml(source: string) {
  const html = markdownToSafeHtml(source)
    .replace(/<a\b[^>]*>/gi, '<span class="result-markdown-link">')
    .replace(/<\/a>/gi, "</span>");
  return { __html: html };
}
