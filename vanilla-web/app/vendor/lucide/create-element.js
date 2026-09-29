/** @license lucide v1.46.0 - ISC — source: lucide/dist/esm/createElement.mjs */
import defaultAttributes from "./default-attributes.js";

const createSvgElement = ([tag, attrs, children]) => {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.keys(attrs).forEach(name => element.setAttribute(name, String(attrs[name])));
  children?.forEach(child => element.appendChild(createSvgElement(child)));
  return element;
};

export default function createElement(iconNode, customAttributes = {}) {
  return createSvgElement(["svg", { ...defaultAttributes, ...customAttributes }, iconNode]);
}
