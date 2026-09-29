import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const snippets = [
  { id: "one", title: "First note", body: "First body", created_at: 1, updated_at: 2, version: 1, share_token: null, can_undo: false, can_redo: false },
  { id: "two", title: "Second note", body: "Second body", created_at: 2, updated_at: 3, version: 1, share_token: null, can_undo: false, can_redo: false },
  { id: "link", title: "Linksaw", body: "https://linksaw.com", created_at: 3, updated_at: 4, version: 1, share_token: null, can_undo: false, can_redo: false },
  { id: "markdown", title: "Markdown preview", body: "**Bold** and *italic* with [a link](https://example.com)\n\n# Compact heading", created_at: 4, updated_at: 5, version: 1, share_token: null, can_undo: false, can_redo: false },
  { id: "long", title: "Long note", body: Array.from({ length: 20 }, (_, index) => `Paragraph ${index + 1}: ${"long content ".repeat(5)}`).join("\n\n"), created_at: 5, updated_at: 6, version: 1, share_token: null, can_undo: false, can_redo: false },
];

function json(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } }));
}

describe("React library interactions", () => {
  beforeEach(() => {
    history.replaceState({}, "", "/home/");
    sessionStorage.clear();
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path.endsWith("/me")) return json({ user: { id: "user", email: "person@example.com", display_name: "Person" } });
      if (path.endsWith("/snippets")) return json({ snippets });
      if (path.endsWith("/preferences")) return json({ autocompleteTrigger: ";" });
      throw new Error(`Unexpected request: ${path}`);
    }));
  });

  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("opens the row that was clicked and keeps its highlight aligned with the viewer", async () => {
    render(<App />);
    const second = await screen.findByRole("button", { name: "Open Second note in Linksaw" });
    fireEvent.click(second);
    expect(within(screen.getByRole("region", { name: "Snippet content" })).getByText("Second body")).toBeVisible();
    expect(second).toHaveAttribute("aria-current", "true");
    expect(location.search).toContain("snippet=two");
  });

  it("filters rows without replacing the current viewer", async () => {
    render(<App />);
    const search = await screen.findByRole("searchbox");
    fireEvent.change(search, { target: { value: "second" } });
    expect(screen.getByRole("button", { name: "Open Second note in Linksaw" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Open First note in Linksaw" })).not.toBeInTheDocument();
  });

  it("opens a neutral Lucide action menu on right click", async () => {
    render(<App />);
    const row = await screen.findByRole("button", { name: "Open Linksaw in Linksaw" });
    fireEvent.contextMenu(row, { clientX: 100, clientY: 100 });
    const menu = screen.getByRole("menu", { name: "Snippet actions" });
    expect(within(menu).getByRole("menuitem", { name: "Open" })).toBeVisible();
    expect(within(menu).getByRole("menuitem", { name: "Copy" })).toBeVisible();
    expect(document.activeElement).not.toBe(within(menu).getByRole("menuitem", { name: "Open" }));
  });

  it("uses arrow-key selection for the visible viewer", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "Open First note in Linksaw" });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    await waitFor(() => expect(within(screen.getByRole("region", { name: "Snippet content" })).getByText("Second body")).toBeVisible());
    expect(screen.getByRole("button", { name: "Open Second note in Linksaw" })).toHaveAttribute("aria-current", "true");
  });

  it("enters focused editing in one click and keeps the sidebar toggle in the editor", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Open First note in Linksaw" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit snippet content" }));
    const editor = await screen.findByRole("textbox", { name: "Snippet text" });
    await waitFor(() => expect(editor).toHaveFocus());
    const editorSurface = document.getElementById("editor");
    expect(editorSurface).not.toBeNull();
    expect(within(editorSurface!).getByRole("button", { name: "Hide sidebar" })).toBeVisible();
  });

  it("opens the existing title directly for inline renaming", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Open First note in Linksaw" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit title" }));
    const title = await screen.findByRole("textbox", { name: "Title" });
    await waitFor(() => expect(title).toHaveFocus());
    expect(title).toHaveValue("First note");
  });

  it("keeps useful inline Markdown in a compact list preview", async () => {
    render(<App />);
    const row = await screen.findByRole("button", { name: "Open Markdown preview in Linksaw" });
    const preview = row.querySelector(".result-preview");
    expect(preview?.querySelector("strong")).toHaveTextContent("Bold");
    expect(preview?.querySelector("em")).toHaveTextContent("italic");
    expect(preview?.querySelector(".result-markdown-link")).toHaveTextContent("a link");
    expect(preview?.querySelector("a")).toBeNull();
  });

  it("supports iPad-width long press and focuses long content without jumping to its end", async () => {
    render(<App />);
    const row = await screen.findByRole("button", { name: "Open Long note in Linksaw" });
    fireEvent.pointerDown(row, { pointerType: "touch", clientX: 80, clientY: 120 });
    await new Promise(resolve => setTimeout(resolve, 600));
    const menu = screen.getByRole("menu", { name: "Snippet actions" });
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Edit" }));
    const editor = await screen.findByRole("textbox", { name: "Snippet text" });
    await waitFor(() => expect(editor).toHaveFocus());
    expect((editor as HTMLTextAreaElement).selectionStart).toBe(0);
  });
});
