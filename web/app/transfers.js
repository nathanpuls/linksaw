export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ITEMS = 2000;

function checkedSnippet(value, record) {
  const source = typeof value === "string" ? { body: value } : value;
  if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error(`Item ${record} is not a snippet.`);
  const title = typeof source.title === "string" ? source.title.trim() : "";
  const body = typeof source.body === "string" ? source.body : typeof source.content === "string" ? source.content : "";
  if (!title && !body.trim()) throw new Error(`Item ${record} is empty.`);
  if (title.length > 160 || body.length > 100000) throw new Error(`Item ${record} exceeds the title or content limit.`);
  return { title, body };
}

function csvRows(text) {
  const rows = [], row = [];
  let field = "", quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const character = source[i];
    if (quoted) {
      if (character === '"' && source[i + 1] === '"') { field += '"'; i++; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"' && !field) quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field); rows.push(row.splice(0)); field = ""; }
    else if (character !== "\r") field += character;
  }
  if (quoted) throw new Error("The CSV contains an unclosed quoted field.");
  row.push(field); rows.push(row);
  return rows.filter(cells => cells.some(cell => cell.trim()));
}

export function parseCsvSnippets(text) {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new Error("Choose a CSV smaller than 5 MB.");
  const rows = csvRows(text);
  if (!rows.length) throw new Error("This CSV is empty.");
  const names = rows[0].map(value => value.trim().toLowerCase());
  const titleNames = ["title", "name", "label"];
  const bodyNames = ["content", "body", "text", "snippet"];
  const titleIndex = names.findIndex(name => titleNames.includes(name));
  const bodyIndex = names.findIndex(name => bodyNames.includes(name));
  const hasHeaders = titleIndex >= 0 || bodyIndex >= 0;
  const records = rows.slice(hasHeaders ? 1 : 0);
  if (records.length > MAX_IMPORT_ITEMS) throw new Error("Import up to 2,000 snippets at a time.");
  const items = records.map((cells, index) => checkedSnippet({
    title: cells[hasHeaders ? titleIndex : (cells.length > 1 ? 0 : -1)] || "",
    body: cells[hasHeaders ? bodyIndex : (cells.length > 1 ? 1 : 0)] || "",
  }, index + 1));
  if (!items.length) throw new Error("This CSV contains no snippets.");
  return items;
}

export function parseJsonSnippets(text) {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new Error("Choose a JSON file smaller than 5 MB.");
  let value;
  try { value = JSON.parse(text); } catch { throw new Error("This JSON file could not be read."); }
  const records = Array.isArray(value) ? value : value?.snippets;
  if (!Array.isArray(records)) throw new Error('JSON must be an array or an object with a "snippets" array.');
  if (!records.length) throw new Error("This JSON file contains no snippets.");
  if (records.length > MAX_IMPORT_ITEMS) throw new Error("Import up to 2,000 snippets at a time.");
  return records.map((item, index) => checkedSnippet(item, index + 1));
}

const csvCell = value => `"${String(value).replaceAll('"', '""')}"`;

export function snippetsToCsv(snippets) {
  return ["Title,Content", ...snippets.map(snippet => `${csvCell(snippet.title || "")},${csvCell(snippet.body || "")}`)].join("\r\n");
}

export function snippetsToJson(snippets) {
  return JSON.stringify({ snippets: snippets.map(snippet => ({ title: snippet.title || "", content: snippet.body || "" })) }, null, 2) + "\n";
}
