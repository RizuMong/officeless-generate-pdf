import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let cssCache;
async function css() {
  cssCache ??= readFile(path.join(root, "public/tailwind.css"), "utf8").catch(() => {
    throw new Error("public/tailwind.css missing — run `npm run build:css`");
  });
  return cssCache;
}

const get = (obj, dotPath) =>
  dotPath.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);

const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ENTITIES[c]);

// ponytail: naive tag stripper — swap for a parser if templates ever need real HTML input
const stripTags = (s) =>
  s
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "") // drop tag AND its content
    .replace(/<\/?[a-zA-Z][^>]*>/g, "") // only real tags — "5 < 6 > 2" stays text
    .replace(/\s+/g, " ")
    .trim();

const substitute = (tpl, ctx, root) =>
  tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const v = get(ctx, key) ?? get(root, key); // loop item first, outer data as fallback
    return v == null ? "" : escapeHtml(stripTags(String(v))); // escape is the real guard
  });

// {{#each rows}}…{{/each}}, nesting allowed. Each slice is substituted exactly
// once, so a value that happens to contain "{{ x }}" is never re-expanded.
function render(tpl, ctx, root) {
  const open = /\{\{#each\s+([\w.]+)\s*\}\}/.exec(tpl);
  if (!open) return substitute(tpl, ctx, root);

  const bodyStart = open.index + open[0].length;
  const tokens = /\{\{#each\s+[\w.]+\s*\}\}|\{\{\/each\}\}/g;
  tokens.lastIndex = bodyStart;
  let depth = 1;
  let close;
  while (depth > 0 && (close = tokens.exec(tpl))) depth += close[0] === "{{/each}}" ? -1 : 1;
  if (depth > 0) throw new Error(`unclosed {{#each ${open[1]}}}`);

  const list = get(ctx, open[1]) ?? get(root, open[1]);
  const body = tpl.slice(bodyStart, close.index);
  return (
    substitute(tpl.slice(0, open.index), ctx, root) +
    (Array.isArray(list) ? list.map((item) => render(body, item, root)).join("") : "") +
    render(tpl.slice(close.index + close[0].length), ctx, root)
  );
}

export const interpolate = (tpl, data) => render(tpl, data, data);

export async function renderTemplate(name, data = {}) {
  if (!/^[\w-]+$/.test(name)) throw new Error(`invalid template name: ${name}`);
  const tpl = await readFile(path.join(root, "templates", `${name}.html`), "utf8");
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>${await css()}</style></head>
<body>${interpolate(tpl, data)}</body></html>`;
}
