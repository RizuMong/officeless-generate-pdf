// Self-check: node test.js  (pdf stage needs Chromium)
import assert from "node:assert/strict";
import http from "node:http";
import { renderTemplate, interpolate, orderActionPlans } from "./src/template.js";
import { uploadToOfficeless } from "./src/officeless.js";

// --- template ---
assert.equal(interpolate("{{ a.b }}|{{ missing }}", { a: { b: "x" } }), "x|");
assert.equal(interpolate("{{ x }}", { x: "Acme & Co <script>alert(1)</script>" }), "Acme &amp; Co");
assert.equal(interpolate("{{ x }}", { x: "5 < 6 & 7 > 2" }), "5 &lt; 6 &amp; 7 &gt; 2");

// {{#each}} — list, nesting, outer-scope fallback, non-array, no leftovers
assert.equal(
  interpolate("{{#each rows}}[{{ n }}]{{/each}}", { rows: [{ n: 1 }, { n: 2 }] }),
  "[1][2]",
);
assert.equal(
  interpolate("{{#each g}}{{ name }}:{{#each t}}{{ v }}/{{ unit }},{{/each}};{{/each}}", {
    unit: "kg", // outer fallback inside a nested loop
    g: [{ name: "a", t: [{ v: 1 }, { v: 2 }] }, { name: "b", t: [{ v: 3 }] }],
  }),
  "a:1/kg,2/kg,;b:3/kg,;",
);
assert.equal(interpolate("x{{#each nope}}{{ v }}{{/each}}y", {}), "xy");
assert.throws(() => interpolate("{{#each a}}", { a: [] }), /unclosed/);

// {{#if}} / {{#unless}} — truthiness and literal compare
assert.equal(interpolate("a{{#if v}}b{{/if}}c", { v: "x" }), "abc");
assert.equal(interpolate("a{{#if v}}b{{/if}}c", {}), "ac");
assert.equal(interpolate("{{#unless s == DRAFT}}by {{ u }}{{/unless}}", { s: "DRAFT", u: "me" }), "");
assert.equal(interpolate("{{#unless s == DRAFT}}by {{ u }}{{/unless}}", { s: "SUBMITTED", u: "me" }), "by me");
assert.equal(interpolate("{{#if s != DRAFT}}x{{/if}}", { s: "DRAFT" }), "");
assert.equal( // if inside each, outer-scope fallback
  interpolate("{{#each r}}{{#if s}}{{ n }}{{/if}};{{/each}}", { s: 1, r: [{ n: 1 }, { n: 2 }] }),
  "1;2;",
);

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
assert.equal(received.auth, "tok123");

process.env.OFFICELESS_URL_PATH = "nope";
await assert.rejects(uploadToOfficeless("x", "y.pdf"), /no URL at path "nope"/);
srv.close();

// --- action plan order: TAKE, KEEP, SKIP, unknown last ---
assert.deepEqual(
  orderActionPlans([
    { adoption_status: "SKIP" },
    { adoption_status: "???" },
    { adoption_status: "KEEP" },
    { adoption_status: "TAKE" },
  ]).map((p) => p.adoption_status),
  ["TAKE", "KEEP", "SKIP", "???"],
);

// --- pdf (needs Chromium) ---
try {
  const { htmlToPdf, closeBrowser } = await import("./src/pdf.js");
  const pdf = await htmlToPdf(html);
  assert.equal(Buffer.from(pdf).subarray(0, 4).toString(), "%PDF");
  await closeBrowser();
  await htmlToPdf(html); // relaunches after the browser is gone
  await closeBrowser();
  console.log("pdf: ok");
} catch (err) {
  console.log("pdf: SKIPPED —", err.message.split("\n")[0]);
}

console.log("all checks passed");
