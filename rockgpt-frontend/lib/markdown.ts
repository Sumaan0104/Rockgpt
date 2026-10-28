import DOMPurify from "dompurify";

export function renderMarkdown(content: string, isStreaming = false): string {
  if (!content) return "";

  // 1. Escape HTML special characters to prevent XSS before parsing markdown
  let text = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 2. Fenced code blocks with language and copy button
  text = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)(?:```|$)/g, (_match, lang, code) => {
    const language = lang || "plaintext";
    const trimmedCode = code.replace(/\n$/, "");
    return `\n<div class="code-block-wrapper"><div class="code-block-header"><span>${language}</span><button type="button" class="code-copy-btn" data-copy="${encodeURIComponent(trimmedCode)}">Copy</button></div><pre><code class="language-${language}">${trimmedCode}</code></pre></div>\n`;
  });

  // 3. Inline code
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");

  // 4. Headings
  text = text.replace(/^#### (.*?)$/gm, "\n<h4>$1</h4>\n");
  text = text.replace(/^### (.*?)$/gm, "\n<h3>$1</h3>\n");
  text = text.replace(/^## (.*?)$/gm, "\n<h2>$1</h2>\n");
  text = text.replace(/^# (.*?)$/gm, "\n<h1>$1</h1>\n");

  // 5. Blockquotes
  text = text.replace(/^&gt; (.*?)$/gm, "\n<blockquote>$1</blockquote>\n");

  // 6. Tables (resilient to streaming rows)
  text = text.replace(
    /((?:^\|.+$\n?)+)/gm,
    (tableMatch) => {
      const rows = tableMatch.trim().split("\n").map(r => r.trim()).filter(Boolean);
      if (rows.length < 2) return tableMatch;

      // Check if second row is separator like |--|--|
      const isSeparator = /^\|(?:\s*:?-+:?\s*\|)+$/.test(rows[1]);
      if (!isSeparator) return tableMatch;

      const headerCells = rows[0].replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
      const bodyRows = rows.slice(2);

      let html = '<div class="table-container"><table><thead><tr>';
      headerCells.forEach(h => {
        html += `<th>${h}</th>`;
      });
      html += '</tr></thead><tbody>';

      bodyRows.forEach(rowStr => {
        const cells = rowStr.replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
        html += '<tr>';
        cells.forEach(c => {
          html += `<td>${c}</td>`;
        });
        for (let i = cells.length; i < headerCells.length; i++) {
          html += '<td></td>';
        }
        html += '</tr>';
      });

      html += '</tbody></table></div>';
      return `\n${html}\n`;
    }
  );

  // 7. Ordered lists (1. Item)
  text = text.replace(/^\d+\.\s+(.*?)$/gm, "<ol-item>$1</ol-item>");
  text = text.replace(/((?:<ol-item>.*?<\/ol-item>\s*)+)/g, (_match, group) => {
    const items = group.replace(/<ol-item>/g, "<li>").replace(/<\/ol-item>/g, "</li>");
    return `\n<ol>${items}</ol>\n`;
  });

  // 8. Unordered lists (- Item, * Item, • Item)
  text = text.replace(/^[•\-\*]\s+(.*?)$/gm, "<ul-item>$1</ul-item>");
  text = text.replace(/((?:<ul-item>.*?<\/ul-item>\s*)+)/g, (_match, group) => {
    const items = group.replace(/<ul-item>/g, "<li>").replace(/<\/ul-item>/g, "</li>");
    return `\n<ul>${items}</ul>\n`;
  });

  // 9. Bold & Italics
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // 10. Links (validate safe schemes: http, https, mailto)
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // 11. Clean paragraph wrapping around text blocks
  const blocks = text.split(/\n{2,}/);
  const formattedBlocks = blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return "";
    // If block is already a structural HTML element, leave it untouched
    if (/^<(div|pre|h[1-6]|ul|ol|blockquote|table)/.test(trimmed)) {
      return trimmed;
    }
    // Convert single newlines inside paragraph to <br/>
    const inner = trimmed.replace(/\n/g, "<br/>");
    return `<p>${inner}</p>`;
  });

  let resultHtml = formattedBlocks.filter(Boolean).join("\n");

  // 12. Elegant Streaming Cursor (strictly inline directly after the last text element)
  if (isStreaming) {
    const cursorTag = `<span class="streaming-cursor" aria-hidden="true"></span>`;
    const trimmed = resultHtml.trim();
    if (/<\/li>\s*<\/(?:ul|ol)>$/i.test(trimmed)) {
      resultHtml = trimmed.replace(/<\/li>(\s*<\/(?:ul|ol)>)$/i, `${cursorTag}</li>$1`);
    } else if (/<\/td>\s*<\/tr>\s*<\/tbody>\s*<\/table>\s*<\/div>$/i.test(trimmed)) {
      resultHtml = trimmed.replace(/<\/td>(\s*<\/tr>\s*<\/tbody>\s*<\/table>\s*<\/div>)$/i, `${cursorTag}</td>$1`);
    } else if (/<\/code>\s*<\/pre>\s*<\/div>$/i.test(trimmed)) {
      resultHtml = trimmed.replace(/<\/code>(\s*<\/pre>\s*<\/div>)$/i, `${cursorTag}</code>$1`);
    } else if (/<\/(p|h[1-6]|blockquote)>$/i.test(trimmed)) {
      resultHtml = trimmed.replace(/<\/(p|h[1-6]|blockquote)>$/i, `${cursorTag}</$1>`);
    } else {
      resultHtml = trimmed + cursorTag;
    }
  }

  // 13. Sanitize with DOMPurify
  if (typeof window !== "undefined") {
    return DOMPurify.sanitize(resultHtml, {
      ADD_ATTR: ["target", "rel", "data-copy", "class"],
      ADD_TAGS: ["span", "table", "thead", "tbody", "tr", "th", "td"],
    });
  }

  return resultHtml;
}
