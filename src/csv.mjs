import Papa from 'papaparse';
import { validSnippet } from '../worker/lib.mjs';

export const MAX_CSV_BYTES = 5 * 1024 * 1024;
export function parseCSV(text) {
  if (new TextEncoder().encode(text).length > MAX_CSV_BYTES) throw new Error('Choose a CSV smaller than 5 MB.');
  if (text.includes('\0')) throw new Error('Export this file as UTF-8 CSV first.');
  const parsed = Papa.parse(text.replace(/^\uFEFF/, ''), { header: false, dynamicTyping: false, skipEmptyLines: false, delimitersToGuess: [',', ';', '\t'] });
  const error = parsed.errors.find(error => error.code !== 'UndetectableDelimiter');
  if (error) throw new Error(`CSV record ${(error.row ?? 0) + 1}: ${error.message}`);
  const rows = parsed.data.map((cells, index) => ({ cells, record: index + 1 })).filter(row => row.cells.some(cell => cell.trim()));
  if (!rows.length) throw new Error('This CSV is empty.');
  if (rows.length > 2001) throw new Error('Import up to 2,000 snippets at a time.');
  const width = Math.max(...rows.map(row => row.cells.length));
  if (width > 100) throw new Error('Choose a CSV with 100 columns or fewer.');
  return { rows, width };
}
const role = value => {
  const name = value.trim().toLowerCase();
  if (['title', 'name', 'label'].includes(name)) return 'title';
  if (['content', 'text', 'snippet', 'body'].includes(name)) return 'content';
  return 'ignore';
};
export function suggestMapping(data, headers) {
  const values = Array.from({ length: data.width }, (_, i) => headers ? role(data.rows[0].cells[i] || '') : 'ignore');
  for (const unique of ['title', 'content']) {
    if (values.filter(value => value === unique).length > 1) values.forEach((value, i) => { if (value === unique) values[i] = 'ignore'; });
  }
  if (!headers && data.width === 1) values[0] = 'content';
  return values;
}
export function guessHeaders(data) { return data.rows[0].cells.some(value => role(value) !== 'ignore'); }
export function mapCSV(data, headers, mapping) {
  const errors = [], items = [];
  if (mapping.filter(value => value === 'content').length !== 1) errors.push('Choose exactly one Content column.');
  if (mapping.filter(value => value === 'title').length > 1) errors.push('Choose no more than one Title column.');
  if (errors.length) return { items, errors, skipped: 0 };
  let skipped = 0;
  for (const row of data.rows.slice(headers ? 1 : 0)) {
    const get = type => row.cells[mapping.indexOf(type)] || '';
    const body = get('content'), title = get('title');
    if (!body.trim() && !title.trim()) { skipped++; continue; }
    if (!body.trim()) { errors.push(`Record ${row.record}: Content is empty.`); continue; }
    const value = { title, body };
    if (!validSnippet(value)) { errors.push(`Record ${row.record}: exceeds the limits (title 160, content 100,000 characters).`); continue; }
    items.push({ ...value, title: title.trim(), record: row.record });
  }
  if (!items.length && !errors.length) errors.push('No snippets to import with this mapping.');
  if (items.length > 2000) errors.push('Import up to 2,000 snippets at a time.');
  return { items, errors, skipped };
}
