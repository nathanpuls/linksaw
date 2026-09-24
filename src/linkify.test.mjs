import test from "node:test";
import assert from "node:assert/strict";
import { linkifyText } from "../web/app/linkify.js";

const links = value => linkifyText(value).filter(part => part.href);

test("linkification detects QK-style URLs, emails, and phone numbers", () => {
  const value = "Visit https://example.com/docs, www.example.org. Email hi+tag@example.com or call (312) 555-1212 and +44 20 7946 0958.";
  assert.deepEqual(links(value).map(({ text, href, type }) => ({ text, href, type })), [
    { text: "https://example.com/docs,", href: "https://example.com/docs", type: "url" },
    { text: "www.example.org.", href: "http://www.example.org", type: "url" },
    { text: "hi+tag@example.com", href: "mailto:hi+tag@example.com", type: "email" },
    { text: "(312) 555-1212", href: "tel:3125551212", type: "phone" },
    { text: "+44 20 7946 0958", href: "tel:+442079460958", type: "phone" },
  ]);
});

test("address destinations normalize formatting while visible text stays exact", () => {
  const addresses = [
    ["25901 US-290,\nCypress, TX 77429", "25901 US-290, Cypress, TX 77429"],
    ["123 Main St, Suite 110,\nKingwood, TX 77339", "123 Main St, Suite 110 Kingwood, TX 77339"],
    ["126 Victoria St,\nLondon SW1E 5EA,\nUnited Kingdom", "126 Victoria St, London SW1E 5EA, United Kingdom"],
  ];
  for (const [original, destination] of addresses) {
    const [link] = links(original);
    assert.equal(link.text, original);
    assert.equal(link.href, `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`);
    assert.equal(link.type, "address");
  }
});

test("linkification preserves the complete source and leaves ordinary text alone", () => {
  const value = "Ordinary text and 12345 remain unchanged. `README.md` is code.\n123 Main St, Apt 4B";
  const parts = linkifyText(value);
  assert.equal(parts.map(part => part.text).join(""), value);
  assert.equal(parts.filter(part => part.href).length, 1);
  assert.equal(parts.find(part => part.href).text, "123 Main St, Apt 4B");
});
