export const trim = value => String(value ?? "").trim();
export const normalize = value => trim(value).toLocaleLowerCase();

export function snippetLabel(snippet) {
  const title = trim(snippet.title);
  if (title) return title;
  const first = trim(snippet.body).split(/\r?\n/, 1)[0].replace(/\s+/g, " ");
  return first.length > 80 ? `${first.slice(0, 77)}…` : first || "Untitled";
}

export function rankedSnippets(snippets, query) {
  const needle = normalize(query);
  if (!needle) return [...snippets];
  return snippets.map((item, order) => {
    const title = normalize(snippetLabel(item));
    const body = normalize(item.body);
    let rank = 99;
    if (title === needle) rank = 0;
    else if (title.startsWith(needle)) rank = 1;
    else if (title.includes(needle)) rank = 2;
    else if (body.includes(needle)) rank = 3;
    return { item, order, rank };
  }).filter(entry => entry.rank < 99)
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .map(entry => entry.item);
}

export function standaloneUrl(value) {
  const text = trim(value);
  if (/^https?:\/\/[^\s]+$/i.test(text)) return text;
  if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?$/i.test(text)) return `https://${text}`;
  return "";
}

export function searchTemplate(value) {
  const url = standaloneUrl(value);
  return url.includes("$") ? url : "";
}

function daysInMonth(year, monthIndex) { return new Date(year, monthIndex + 1, 0).getDate(); }

function applyOffset(base, offset) {
  const date = new Date(base);
  for (const [, sign, amountText, unit] of offset.matchAll(/([+-])(\d+)([yMdhm])/g)) {
    const amount = Number(amountText) * (sign === "-" ? -1 : 1);
    if (unit === "M" || unit === "y") {
      const targetMonth = date.getMonth() + amount * (unit === "y" ? 12 : 1);
      const day = date.getDate();
      date.setDate(1); date.setMonth(targetMonth);
      date.setDate(Math.min(day, daysInMonth(date.getFullYear(), date.getMonth())));
    } else if (unit === "d") date.setDate(date.getDate() + amount);
    else if (unit === "h") date.setHours(date.getHours() + amount);
    else if (unit === "m") date.setMinutes(date.getMinutes() + amount);
  }
  return date;
}

function attr(body, name) {
  return body.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`))?.[1]
    ?? body.match(new RegExp(`${name}\\s*=\\s*([^\\s]+)`))?.[1];
}

function formatDate(date, format) {
  const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const pad = number => String(number).padStart(2, "0");
  const hour12 = date.getHours() % 12 || 12;
  const values = {
    EEEE: weekday[date.getDay()], EEE: weekday[date.getDay()].slice(0, 3),
    MMMM: months[date.getMonth()], MMM: months[date.getMonth()].slice(0, 3),
    yyyy: String(date.getFullYear()), yy: pad(date.getFullYear() % 100),
    MM: pad(date.getMonth() + 1), M: String(date.getMonth() + 1),
    dd: pad(date.getDate()), d: String(date.getDate()),
    HH: pad(date.getHours()), H: String(date.getHours()),
    hh: pad(hour12), h: String(hour12),
    mm: pad(date.getMinutes()), m: String(date.getMinutes()),
    ss: pad(date.getSeconds()), s: String(date.getSeconds()),
    SSS: String(date.getMilliseconds()).padStart(3, "0"),
    a: date.getHours() < 12 ? "AM" : "PM",
  };
  const tokens = Object.keys(values).sort((a, b) => b.length - a.length);
  let output = "", literal = false;
  for (let index = 0; index < format.length;) {
    if (format[index] === "'") {
      if (format[index + 1] === "'") { output += "'"; index += 2; }
      else { literal = !literal; index++; }
      continue;
    }
    if (!literal) {
      const token = tokens.find(item => format.startsWith(item, index));
      if (token) { output += values[token]; index += token.length; continue; }
    }
    output += format[index++];
  }
  return output;
}

export function expandDynamic(value, { clipboard = "", now = new Date() } = {}) {
  const marker = "\u0000CURSOR\u0000";
  const textWithMarker = String(value ?? "").replace(/\{([^{}\r\n]+)\}/g, (whole, raw) => {
    const body = raw.trim();
    if (body === "clipboard") return clipboard;
    if (body === "cursor") return marker;
    const keyword = body.match(/^([a-z]+)/)?.[1];
    const defaults = { date: "MM/dd/yyyy", time: "h:mm a", datetime: "MM/dd/yyyy h:mm a", day: "EEEE" };
    if (!defaults[keyword]) return whole;
    return formatDate(applyOffset(now, attr(body, "offset") || ""), attr(body, "format") || defaults[keyword]);
  });
  const markerAt = textWithMarker.indexOf(marker);
  const text = textWithMarker.replaceAll(marker, "");
  const cursorLeft = markerAt < 0 ? 0 : [...textWithMarker.slice(markerAt + marker.length).replaceAll(marker, "")].length;
  return { text, cursorLeft };
}
