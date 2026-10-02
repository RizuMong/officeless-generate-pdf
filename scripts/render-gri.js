// Render every GRI fixture to out/*.pdf:  npm run render:gri   (needs Chrome locally)
import assert from "node:assert/strict";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { renderTemplate, pdfOptionsFor } from "../src/template.js";
import { htmlToPdf, closeBrowser } from "../src/pdf.js";

const dir = new URL("../examples/", import.meta.url);
const files = [
  "gri-quantitative-dashboard.json",
  ...readdirSync(new URL("gri-edge-cases/", dir)).map((f) => `gri-edge-cases/${f}`).filter((f) => f.endsWith(".json")),
];
mkdirSync("out", { recursive: true });

try {
  for (const f of files) {
    const { template, data } = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
    const html = await renderTemplate(template, data);
    assert.ok(!/<script/i.test(html), `${f}: raw <script> in output`);
    assert.ok(!/(https?:)?\/\/[\w.-]+\.[a-z]{2,}/i.test(html.replace(/xmlns="[^"]+"/g, "")), `${f}: remote URL in output`);
    const pdf = Buffer.from(await htmlToPdf(html, await pdfOptionsFor(template, data)));
    assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
    const name = f.split("/").pop().replace(".json", "");
    writeFileSync(`out/${name}.pdf`, pdf);
    const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
    console.log(`${name}.pdf  ${pages} pages  ${(pdf.length / 1024).toFixed(0)} KB`);
  }
} finally {
  await closeBrowser();
}
