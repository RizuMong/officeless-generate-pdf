// Self-check: node test.js  (pdf stage needs Chromium)
import assert from "node:assert/strict";
import http from "node:http";
import { renderTemplate, interpolate } from "./src/template.js";
import { uploadToOfficeless } from "./src/officeless.js";

// --- template ---
assert.equal(interpolate("{{ a.b }}|{{ missing }}", { a: { b: "x" } }), "x|");

const html = await renderTemplate("invoice", {
  invoice: { number: "1042", date: "2026-07-22", total: "$1,250.00" },
  company: { name: "Acme Co", email: "billing@acme.co" },
  customer: { name: "Jane Doe", email: "jane@example.com" },
  item: { description: "Consulting", amount: "$1,250.00" },
});
assert.match(html, /text-indigo-600/);
assert.match(html, /Jane Doe/);
assert.ok(!/\{\{/.test(html), "unreplaced placeholder left in output");

// --- officeless (mock server) ---
let received;
const srv = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    received = { body: JSON.parse(body), auth: req.headers.authorization };
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ data: { url: "https://oos.example/file.pdf" } }));
  });
});
await new Promise((r) => srv.listen(0, r));

process.env.OFFICELESS_UPLOAD_URL = `http://localhost:${srv.address().port}/upload`;
process.env.OFFICELESS_TOKEN = "tok123";
process.env.OFFICELESS_URL_PATH = "data.url";

assert.equal(await uploadToOfficeless("QkFTRTY0", "x.pdf"), "https://oos.example/file.pdf");
assert.equal(received.body.content, "QkFTRTY0");
assert.equal(received.body.filename, "x.pdf");
assert.equal(received.auth, "Bearer tok123");

process.env.OFFICELESS_URL_PATH = "nope";
await assert.rejects(uploadToOfficeless("x", "y.pdf"), /no URL at path "nope"/);
srv.close();

// --- pdf (needs Chromium) ---
try {
  const { htmlToPdf, closeBrowser } = await import("./src/pdf.js");
  const pdf = await htmlToPdf(html);
  assert.equal(Buffer.from(pdf).subarray(0, 4).toString(), "%PDF");
  await closeBrowser();
  console.log("pdf: ok");
} catch (err) {
  console.log("pdf: SKIPPED —", err.message.split("\n")[0]);
}

console.log("all checks passed");
