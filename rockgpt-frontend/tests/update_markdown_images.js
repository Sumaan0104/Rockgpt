import fs from "fs";

const filePath = "C:/Users/Suman Mansuri/Downloads/auracrystal/public/Rockgpt1/rockgpt-frontend/lib/markdown.ts";
let code = fs.readFileSync(filePath, "utf8");

const oldLinkBlock = `  // 11. Links (validate safe schemes: http, https, mailto)
  text = text.replace(
    /\\[([^\\]]+)\\]\\((https?:\\/\\/[^\\s)]+)\\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );`;

const newImageAndLinkBlock = `  // 10.5. Markdown Images ![alt](url) (must be parsed before regular links)
  text = text.replace(
    /!\\[([^\\]]*)\\]\\((https?:\\/\\/[^\\s)]+)\\)/g,
    '<div class="msg-image-wrap"><img src="$2" alt="$1" class="msg-image" loading="lazy" /><span class="msg-image-caption">$1</span></div>'
  );

  // 11. Links (validate safe schemes: http, https, mailto)
  text = text.replace(
    /\\[([^\\]]+)\\]\\((https?:\\/\\/[^\\s)]+)\\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );`;

const normCode = code.replace(/\r\n/g, "\n");
const normOldLink = oldLinkBlock.replace(/\r\n/g, "\n");
const normNewLink = newImageAndLinkBlock.replace(/\r\n/g, "\n");

let updated = normCode.replace(normOldLink, normNewLink);

// Update DOMPurify tags and attributes
const oldSanitize = `      ADD_ATTR: ["target", "rel", "data-copy", "class", "href", "aria-hidden"],
      ADD_TAGS: [
        "span",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "br",
        "hr",
        "b",
        "strong",
        "i",
        "em",
        "u",
        "s",
        "del",
        "sub",
        "sup",
        "mark"
      ],`;

const newSanitize = `      ADD_ATTR: ["target", "rel", "data-copy", "class", "href", "aria-hidden", "src", "alt", "loading"],
      ADD_TAGS: [
        "span",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "br",
        "hr",
        "b",
        "strong",
        "i",
        "em",
        "u",
        "s",
        "del",
        "sub",
        "sup",
        "mark",
        "div",
        "img"
      ],`;

const normOldSanitize = oldSanitize.replace(/\r\n/g, "\n");
const normNewSanitize = newSanitize.replace(/\r\n/g, "\n");

updated = updated.replace(normOldSanitize, normNewSanitize);

fs.writeFileSync(filePath, updated.replace(/\n/g, "\r\n"), "utf8");
console.log("Updated markdown.ts with image rendering and DOMPurify allowances!");
