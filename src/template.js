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

// Blocks: {{#each rows}}…{{/each}}, {{#if x}}…{{/if}}, {{#unless x}}…{{/unless}},
// the last two also as "{{#if x == LITERAL}}" / "!=". Nesting allowed. Each slice
// is substituted exactly once, so a value containing "{{ x }}" is never re-expanded.
const BLOCK = /\{\{#(each|if|unless)\s+([\w.]+)(?:\s*(==|!=)\s*([^}]*?))?\s*\}\}/;
const BLOCK_TOKENS = /\{\{#(?:each|if|unless)\s+[^{}]*\}\}|\{\{\/(?:each|if|unless)\}\}/g;

function render(tpl, ctx, root) {
  const open = BLOCK.exec(tpl);
  if (!open) return substitute(tpl, ctx, root);
  const [tag, kind, key, op, literal] = open;

  const bodyStart = open.index + tag.length;
  BLOCK_TOKENS.lastIndex = bodyStart;
  let depth = 1;
  let close;
  while (depth > 0 && (close = BLOCK_TOKENS.exec(tpl))) depth += close[0][2] === "/" ? -1 : 1;
  if (depth > 0) throw new Error(`unclosed {{#${kind} ${key}}}`);

  const val = get(ctx, key) ?? get(root, key);
  const body = tpl.slice(bodyStart, close.index);

  let inner;
  if (kind === "each") {
    inner = Array.isArray(val) ? val.map((item) => render(body, item, root)).join("") : "";
  } else {
    const match = op
      ? (String(val) === String(literal).trim()) === (op === "==")
      : Boolean(val);
    inner = (kind === "if") === match ? render(body, ctx, root) : "";
  }

  return (
    substitute(tpl.slice(0, open.index), ctx, root) +
    inner +
    render(tpl.slice(close.index + close[0].length), ctx, root)
  );
}

export const interpolate = (tpl, data) => render(tpl, data, data);

// Action plans always read TAKE, KEEP, then SKIP — unknown statuses fall in after.
const STATUS_ORDER = { TAKE: 0, KEEP: 1, SKIP: 2 };
export const orderActionPlans = (plans) =>
  [...plans].sort(
    (a, b) =>
      (STATUS_ORDER[a.adoption_status] ?? 9) - (STATUS_ORDER[b.adoption_status] ?? 9),
  );

export async function renderTemplate(name, data = {}) {
  if (!/^[\w-]+$/.test(name)) throw new Error(`invalid template name: ${name}`);
  if (Array.isArray(data.action_plans))
    data = { ...data, action_plans: orderActionPlans(data.action_plans) };
  const tpl = await readFile(path.join(root, "templates", `${name}.html`), "utf8");
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>${await css()}</style></head>
<body>${interpolate(tpl, data)}</body></html>`;
}
