declare module "../../web/app/linkify.js" {
  export function standaloneWebUrl(value: string): string;
}
declare module "../../web/app/markdown.js" {
  export function markdownToSafeHtml(value: string): string;
  export function sourceOffsetFromRenderedPoint(root: HTMLElement, source: string, node: Node, offset: number, x: number, y: number): number;
}
declare module "../../web/app/transfers.js" {
  export function detectPastedSnippets(value: string, format?: string): { format: string; snippets: Array<{ title: string; body: string }> };
  export function parseCsvSnippets(value: string): Array<{ title: string; body: string }>;
  export function parseJsonSnippets(value: string): Array<{ title: string; body: string }>;
  export function snippetsToCsv(value: unknown[]): string;
  export function snippetsToJson(value: unknown[]): string;
}
