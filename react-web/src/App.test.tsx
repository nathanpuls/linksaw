import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const snippets = [
  { id: "one", title: "First note", body: "First body", created_at: 1, updated_at: 2, version: 1, share_token: null, can_undo: false, can_redo: false },
  { id: "two", title: "Second note", body: "Second body", created_at: 2, updated_at: 3, version: 1, share_token: null, can_undo: false, can_redo: false },
  { id: "link", title: "Linksaw", body: "https://linksaw.com", created_at: 3, updated_at: 4, version: 1, share_token: null, can_undo: false, can_redo: false },
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
});
