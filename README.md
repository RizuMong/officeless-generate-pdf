# officeless-generate-pdf

Renders Tailwind HTML templates to PDF, base64-encodes them, uploads to the
officeless (jojonomic OOS) endpoint, and returns the storage URL.

**Pipeline:** template → HTML (inlined Tailwind) → PDF (Puppeteer) → base64 → officeless upload → storage URL

## Stack

Node >= 18, ESM, Express, Puppeteer, Tailwind CSS (precompiled). No template
engine, no HTTP client — native `fetch` and a tiny `{{ var }}` interpolator.

## Layout

```
server.js               Express entry — POST /generate, GET /health
src/template.js         load template, interpolate, inline compiled CSS
src/pdf.js              Puppeteer render (shared browser, printBackground:true)
src/officeless.js       base64 upload → storage URL
src/input.css           @tailwind directives
templates/invoice.html  simple example
templates/sustainability.html  multi-page report — tables, nested loops, page break
examples/sustainability.json   ready-made payload for the report
public/tailwind.css     build output (gitignored)
test.js                 self-check
```

## Setup

```bash
npm install
npm run build:css
cp .env.example .env      # set OFFICELESS_TOKEN
npm start
```

`npm run dev` rebuilds CSS then runs the server with `--watch`.

## Usage

```bash
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{"template":"invoice","upload":false,
       "data":{"invoice":{"number":"1042","date":"2026-07-22","total":"$1,250.00"},
               "company":{"name":"Acme Co","email":"billing@acme.co"},
               "customer":{"name":"Jane Doe","email":"jane@example.com"},
               "item":{"description":"Consulting","amount":"$1,250.00"}}}'
```

Body: `{ template, data, filename?, upload? }`. Missing `template` → 400.
Request body limit 4mb.

Every response uses the same envelope:

```json
{ "error": false, "message": "PDF generated and uploaded",
  "data": { "filename": "invoice-1042.pdf", "url": "https://…" } }
```

`upload: false` puts `{ filename, base64 }` in `data` instead, so you can verify
the PDF without a live endpoint. Failures return
`{ "error": true, "message": "<reason>", "data": {} }` with a 4xx/5xx status.

## Template syntax

`{{ key }}` and `{{ nested.key }}` — missing keys render empty. Values are
stripped of HTML tags and escaped, so data can never inject markup.

`{{#each rows}} … {{/each}}` repeats a block per array item. Inside it, keys
resolve against the item first and fall back to the outer data, so a shared
`{{ unit }}` still works inside a loop. Blocks nest:

```html
{{#each pillars}}
  <h3>{{ name }}</h3>
  {{#each topics}}<tr><td>{{ topic }}</td><td>{{ result }}</td></tr>{{/each}}
{{/each}}
```

`templates/sustainability.html` is the worked example: KPI grid, a totalled
emissions table, progress bars driven by data (`style="width: {{ progress }}%"`),
nested pillar/topic tables, and a forced page break (`break-before-page`).

```bash
curl -s -X POST localhost:3000/generate \
  -H 'Content-Type: application/json' \
  -d @examples/sustainability.json
```

No conditionals and no loop index — add them when a template actually needs one.

## officeless config

| var | default | required | meaning |
|-----|---------|----------|---------|
| `OFFICELESS_UPLOAD_URL` | — | yes | endpoint |
| `OFFICELESS_TOKEN` | — | yes | JWT, sent **raw** in `Authorization` |
| `OFFICELESS_URL_PATH` | `data.url` | no | dot-path to URL in response |

Body fields are fixed: `{ "content": "<base64>", "filename": "<name>" }`.

Two confirmed quirks: the `Authorization` header takes the raw token — a
`Bearer ` prefix returns 401 — and the storage URL lives at `data.url`.
The API also sniffs content and rejects a mismatch with the filename extension
(`FILE.003`), so `.pdf` must carry real PDF bytes.

## Gotchas

- `printBackground: true` is mandatory or Tailwind backgrounds vanish.
- Fonts: render awaits `document.fonts.ready` + `networkidle0`.
- **Rebuild CSS after editing templates** — the compiler only keeps classes it sees.
- Multi-page breaks: use `break-inside-avoid` / `@page` rules in the template.
- No Chromium is downloaded at install. Locally the render uses your installed
  Google Chrome (`channel: "chrome"`); on Vercel/Lambda it uses the bundled
  `@sparticuz/chromium`. See `src/pdf.js`.

## Deployment

- **Container:** install Chrome in the image, or set `AWS_LAMBDA_FUNCTION_NAME`
  to force the bundled Chromium path.
- **Serverless:** works as-is — `puppeteer-core` + `@sparticuz/chromium`
  — the bundled Chromium exceeds deploy size limits.

## Check

```bash
node test.js
```

Covers interpolation, CSS inlining, the officeless upload against a mock server
(fields, Bearer header, URL extraction, missing-path error), and a real PDF
render if Chromium is available.
