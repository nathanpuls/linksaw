import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../web/app/app.js", import.meta.url), "utf8");

test("empty snippets are rejected before the saving state begins", () => {
  const submitHandler = source.match(/\$\("editor-form"\)\.addEventListener\("submit",[\s\S]*?\n\}\);/)?.[0];
  assert.ok(submitHandler, "editor submit handler is present");
  assert.match(submitHandler, /!payload\.title\.trim\(\) && !payload\.body\.trim\(\)/);
  assert.ok(submitHandler.indexOf("Enter content or a title") < submitHandler.indexOf("Saving…"));
});
