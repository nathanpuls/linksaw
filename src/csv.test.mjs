import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, suggestMapping, mapCSV, guessHeaders } from './csv.mjs';
test('CSV preserves quoted commas, multiline bodies, quotes, Unicode and leading zeros', () => {
  const data = parseCSV('\uFEFFName,Body,Unused\r\nHi,"Hello, world\n""quote"" 🎉",ignore\r\n');
  const result = mapCSV(data, true, suggestMapping(data, true));
  assert.equal(guessHeaders(data), true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.items[0], { title: 'Hi', body: 'Hello, world\n"quote" 🎉', record: 2 });
});
test('headerless mapping includes first record and ignores extra columns', () => {
  const data = parseCSV('Alpha,Body,ignore\nBeta,Text,end');
  const result = mapCSV(data, false, ['title', 'content', 'ignore']);
  assert.equal(result.items.length, 2);
  assert.deepEqual(result.items[0], { title: 'Alpha', body: 'Body', record: 1 });
});
test('ambiguous aliases require explicit mapping; duplicate content is invalid', () => {
  const data = parseCSV('name,body,text\na,b,c');
  assert.deepEqual(suggestMapping(data, true), ['title', 'ignore', 'ignore']);
  assert.match(mapCSV(data, true, ['title', 'content', 'content']).errors[0], /exactly one/);
});
test('empty, malformed and oversized field values are blocked', () => {
  assert.throws(() => parseCSV(' \n,,\n'), /empty/);
  assert.throws(() => parseCSV('title,content\nx,"unclosed'), /CSV record/);
  const data = parseCSV('name,body\n' + 'x'.repeat(161) + ',text');
  assert.match(mapCSV(data, true, ['title', 'content']).errors[0], /limits/);
});
test('blank mapped rows skip; missing content is reported, not silently dropped', () => {
  const result = mapCSV(parseCSV('title,content,extra\na,,x\n,,ignored\nb,text,y'), true, ['title', 'content', 'ignore']);
  assert.equal(result.skipped, 1); assert.equal(result.errors.length, 1); assert.equal(result.items.length, 1);
});
test('single-column headerless data and semicolon exports work', () => {
  const data = parseCSV('001\n002');
  assert.equal(mapCSV(data, false, suggestMapping(data, false)).items[0].body, '001');
  assert.deepEqual(suggestMapping(parseCSV('Title;Content;Extra\na;b;c'), true), ['title', 'content', 'ignore']);
});
