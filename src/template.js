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

export function interpolate(tpl, data) {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const v = get(data, key);
    return v == null ? "" : String(v);
  });
}

export async function renderTemplate(name, data = {}) {
  if (!/^[\w-]+$/.test(name)) throw new Error(`invalid template name: ${name}`);
  const tpl = await readFile(path.join(root, "templates", `${name}.html`), "utf8");
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>${await css()}</style></head>
<body>${interpolate(tpl, data)}</body></html>`;
}
