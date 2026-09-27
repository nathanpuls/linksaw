import createElement from "./vendor/lucide/create-element.js";
import externalLink from "./vendor/lucide/external-link.js";
import copy from "./vendor/lucide/copy.js";
import share from "./vendor/lucide/share.js";
import pencil from "./vendor/lucide/pencil.js";
import trash from "./vendor/lucide/trash.js";

const menuIcons = { externalLink, copy, share, pencil, trash };

export function createLucideMenuIcon(name) {
  return createElement(menuIcons[name], {
    width: 17, height: 17, "stroke-width": 1.8,
    "aria-hidden": "true", focusable: "false",
  });
}
