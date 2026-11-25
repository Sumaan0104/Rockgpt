import DOMPurify from "dompurify";
import katex from "katex";

export function renderMarkdown(content: string, isStreaming = false): string {
  if (!content) return "";

  // 1. Escape HTML special characters to prevent XSS before parsing markdown
  let text = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 2. Fenced code blocks with language and copy button (stashed with placeholders to protect code contents)
  const codeBlocks: string[] = [];
  text = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)(?:```|$)/g, (_match, lang, code) => {
    const language = lang || "code";
    const trimmedCode = code.replace(/\n$/, "");
    const rawCodeForCopy = trimmedCode
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
    const placeholder = `%%ROCKGPT_CB_${codeBlocks.length}%%`;
    codeBlocks.push(
      `<pre><div class="ph"><span>${language}</span><button type="button" class="cc code-copy-btn" data-copy="${encodeURIComponent(rawCodeForCopy)}">Copy</button></div><code class="language-${language}">${trimmedCode}</code></pre>`
    );
    return `\n\n${placeholder}\n\n`;
  });

  // 3. Inline code (stashed with placeholders)
  const inlineCodes: string[] = [];
  text = text.replace(/`([^`]+)`/g, (_match, inline) => {
    const placeholder = `%%ROCKGPT_IC_${inlineCodes.length}%%`;
    inlineCodes.push(`<code>${inline}</code>`);
    return placeholder;
  });

  // 3.5. LaTeX Math blocks ($$...$$ and \[...\]) & Inline Math ($...$ and \(...\))
  const mathBlocks: string[] = [];
  const stashMath = (expr: string, displayMode: boolean) => {
    const raw = expr
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .trim();
    const placeholder = `%%ROCKGPT_MATH_${mathBlocks.length}%%`;
    try {
      const rendered = katex.renderToString(raw, {
        displayMode,
        throwOnError: false,
        strict: false,
      });
      mathBlocks.push(
        displayMode ? `<div class="katex-block">${rendered}</div>` : rendered
      );
    } catch {
      mathBlocks.push(displayMode ? `<pre><code>${expr}</code></pre>` : `<code>${expr}</code>`);
    }
    return displayMode ? `\n\n${placeholder}\n\n` : placeholder;
  };

  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_m, expr) => stashMath(expr, true));
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_m, expr) => stashMath(expr, true));
  text = text.replace(/\\\((.+?)\\\)/g, (_m, expr) => stashMath(expr, false));
  // Inline $...$: require non-space next to delimiters and avoid currency like "$10 and $20"
  text = text.replace(/(^|[^\\$])\$([^\s$][^$\n]*?[^\s$]|[^\s$\d])\$(?!\d)/g, (_m, prefix, expr) => {
    return `${prefix}${stashMath(expr, false)}`;
  });

  // 4. Restore safe inline formatting tags outside of code blocks
  text = text
    .replace(/&lt;br\s*\/?&gt;/gi, "<br/>")
    .replace(/&amp;lt;br\s*\/?&amp;gt;/gi, "<br/>")
    .replace(/&lt;hr\s*\/?&gt;/gi, "<hr/>")
    .replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/gi, "<strong>$1</strong>")
    .replace(/&lt;strong&gt;(.*?)&lt;\/strong&gt;/gi, "<strong>$1</strong>")
    .replace(/&lt;i&gt;(.*?)&lt;\/i&gt;/gi, "<em>$1</em>")
    .replace(/&lt;em&gt;(.*?)&lt;\/em&gt;/gi, "<em>$1</em>")
    .replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/gi, "<u>$1</u>")
    .replace(/&lt;s&gt;(.*?)&lt;\/s&gt;/gi, "<del>$1</del>")
    .replace(/&lt;del&gt;(.*?)&lt;\/del&gt;/gi, "<del>$1</del>")
    .replace(/&lt;strike&gt;(.*?)&lt;\/strike&gt;/gi, "<del>$1</del>")
    .replace(/&lt;sub&gt;(.*?)&lt;\/sub&gt;/gi, "<sub>$1</sub>")
    .replace(/&lt;sup&gt;(.*?)&lt;\/sup&gt;/gi, "<sup>$1</sup>")
    .replace(/&lt;mark&gt;(.*?)&lt;\/mark&gt;/gi, "<mark>$1</mark>");

  // 5. Headings
  text = text.replace(/^#### (.*?)$/gm, "\n<h4>$1</h4>\n");
  text = text.replace(/^### (.*?)$/gm, "\n<h3>$1</h3>\n");
  text = text.replace(/^## (.*?)$/gm, "\n<h2>$1</h2>\n");
  text = text.replace(/^# (.*?)$/gm, "\n<h1>$1</h1>\n");

  // 6. Blockquotes
  text = text.replace(/^&gt; ?(.*?)$/gm, "\n<blockquote>$1</blockquote>\n");

  // 7. Tables (resilient to streaming rows and multi-line cell formatting)
  text = text.replace(/((?:^\|.+$\n?)+)/gm, (tableMatch) => {
    const rows = tableMatch
      .trim()
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean);
    if (rows.length < 2) return tableMatch;

    const isSeparator = /^\|(?:\s*:?-+:?\s*\|?)+$/.test(rows[1]);
    if (!isSeparator) return tableMatch;

    const headerCells = rows[0]
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
    const bodyRows = rows.slice(2);

    let html = '<div class="table-container"><table><thead><tr>';
    headerCells.forEach((h) => {
      html += `<th>${h}</th>`;
    });
    html += "</tr></thead><tbody>";

    bodyRows.forEach((rowStr) => {
      const cells = rowStr
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim());
      html += "<tr>";
      cells.forEach((c) => {
        const cellContent = c.replace(/(?:^|<br\s*\/?>)\s*[-*]\s+/gi, (match) =>
          match.startsWith("<") ? "<br/>• " : "• "
        );
        html += `<td>${cellContent}</td>`;
      });
      for (let i = cells.length; i < headerCells.length; i++) {
        html += "<td></td>";
      }
      html += "</tr>";
    });

    html += "</tbody></table></div>";
    return `\n${html}\n`;
  });

  // 8. Ordered lists (1. Item)
  text = text.replace(/^\d+[.)]\s+(.*?)$/gm, "<ol-item>$1</ol-item>");
  text = text.replace(/((?:<ol-item>.*?<\/ol-item>\s*)+)/g, (_match, group) => {
    const items = group.replace(/<ol-item>/g, "<li>").replace(/<\/ol-item>/g, "</li>");
    return `\n<ol>${items}</ol>\n`;
  });

  // 9. Unordered lists (- Item, * Item, • Item)
  text = text.replace(/^[•\-\*]\s+(.*?)$/gm, "<ul-item>$1</ul-item>");
  text = text.replace(/((?:<ul-item>.*?<\/ul-item>\s*)+)/g, (_match, group) => {
    const items = group.replace(/<ul-item>/g, "<li>").replace(/<\/ul-item>/g, "</li>");
    return `\n<ul>${items}</ul>\n`;
  });

  // Horizontal rule
  text = text.replace(/^---+$/gm, "\n<hr/>\n");

  // 10. Bold & Italics
  text = text.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");

  // 10.5. Markdown Images ![alt](url) (with interactive click-to-zoom preview & download)
  const safeAttr = (s: string) =>
    String(s || "")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  text = text.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^\s)"'<>]+)\)/g,
    (_m, alt, url) => {
      const sUrl = safeAttr(url);
      const sAlt = safeAttr(alt);
      return `<div class="msg-image-wrap"><img src="${sUrl}" alt="${sAlt}" class="msg-image" loading="lazy" data-preview="img" /><div class="msg-image-bar"><span class="msg-image-caption">${sAlt || "Generated Visual"}</span><button type="button" class="msg-image-dl" data-dl-img="${sUrl}" data-dl-name="${sAlt || "rockgpt-image"}">Download</button></div></div>`;
    }
  );

  // 11. Links (validate safe schemes: http, https)
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)"'<>]+)\)/g,
    (_m, label, url) => `<a href="${safeAttr(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`
  );

  // 12. Clean paragraph wrapping around text blocks
  const blocks = text.split(/\n{2,}/);
  const formattedBlocks = blocks.map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return "";
    if (
      /^<(div|pre|h[1-6]|ul|ol|blockquote|table|hr)/.test(trimmed) ||
      /^%%ROCKGPT_(CB|MATH)_\d+%%$/.test(trimmed)
    ) {
      return trimmed;
    }
    const inner = trimmed.replace(/\n/g, "<br/>");
    return `<p>${inner}</p>`;
  });

  let resultHtml = formattedBlocks.filter(Boolean).join("\n");

  // 13. Restore placeholders
  mathBlocks.forEach((mHtml, idx) => {
    resultHtml = resultHtml.replace(`%%ROCKGPT_MATH_${idx}%%`, mHtml);
  });
  inlineCodes.forEach((code, idx) => {
    resultHtml = resultHtml.replace(`%%ROCKGPT_IC_${idx}%%`, code);
  });
  codeBlocks.forEach((block, idx) => {
    resultHtml = resultHtml.replace(`%%ROCKGPT_CB_${idx}%%`, block);
  });

  // 14. Elegant Streaming Cursor directly inline after the last element
  if (isStreaming) {
    const cursorTag = `<span class="streaming-cursor" aria-hidden="true"></span>`;
    const trimmed = resultHtml.trim();
    if (/<\/li>\s*<\/(?:ul|ol)>$/i.test(trimmed)) {
      resultHtml = trimmed.replace(/<\/li>(\s*<\/(?:ul|ol)>)$/i, `${cursorTag}</li>$1`);
    } else if (/<\/td>\s*<\/tr>\s*<\/tbody>\s*<\/table>\s*<\/div>$/i.test(trimmed)) {
      resultHtml = trimmed.replace(
        /<\/td>(\s*<\/tr>\s*<\/tbody>\s*<\/table>\s*<\/div>)$/i,
        `${cursorTag}</td>$1`
      );
    } else if (/<\/code>\s*<\/pre>$/i.test(trimmed)) {
      resultHtml = trimmed.replace(/<\/code>(\s*<\/pre>)$/i, `${cursorTag}</code>$1`);
    } else if (/<\/(p|h[1-6]|blockquote)>$/i.test(trimmed)) {
      resultHtml = trimmed.replace(/<\/(p|h[1-6]|blockquote)>$/i, `${cursorTag}</$1>`);
    } else {
      resultHtml = trimmed + cursorTag;
    }
  }

  // 15. Sanitize with DOMPurify
  if (typeof window !== "undefined") {
    return DOMPurify.sanitize(resultHtml, {
      ADD_ATTR: [
        "target",
        "rel",
        "data-copy",
        "data-preview",
        "data-dl-img",
        "data-dl-name",
        "class",
        "href",
        "aria-hidden",
        "src",
        "alt",
        "loading",
        "style",
      ],
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
        "img",
        "math",
        "semantics",
        "mrow",
        "mi",
        "mo",
        "mn",
        "msup",
        "msub",
        "mfrac",
        "msqrt",
        "annotation",
      ],
    });
  }

  return resultHtml;
}
