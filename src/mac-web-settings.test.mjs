import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./main.mjs", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("Mac settings delegates import and export to the anchored web settings section", () => {
  assert.match(html, /<h3 id="web-transfer-title">Import and export<\/h3>/);
  assert.match(html, /id="open-web-settings"[^>]*>Open web settings <span aria-hidden="true">↗<\/span>/);
  assert.doesNotMatch(html, /id="open-import"|id="import-dialog"|id="csv-file"/);
  assert.match(source, /WEB_TRANSFER_SETTINGS_URL = "https:\/\/linksaw\.com\/app\/\?view=settings#import-export"/);
  assert.match(source, /await openUrl\(WEB_TRANSFER_SETTINGS_URL\)/);
  assert.doesNotMatch(source, /setupImporter/);
});
