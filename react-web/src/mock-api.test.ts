import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockApi } from "./mock-api";

describe("local mock data", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("persists create, edit, and delete operations in localStorage", async () => {
    const api = createMockApi();
    const [, initial] = await api.session();
    expect(initial.snippets.length).toBeGreaterThan(2);

    const created = (await api.create({ title: "Local note", body: "Testing the React UI", importId: "test" })).snippet;
    const updated = (await api.update(created, { title: "Updated note", body: "Saved locally" })).snippet;
    expect((await createMockApi().get(updated.id)).snippet.body).toBe("Saved locally");

    await api.remove(updated);
    const [, refreshed] = await createMockApi().session();
    expect(refreshed.snippets.some(item => item.id === updated.id)).toBe(false);
    expect((await createMockApi().deleted()).snippets.some(item => item.id === updated.id)).toBe(true);
  });
});
