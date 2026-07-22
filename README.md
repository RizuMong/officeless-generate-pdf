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
templates/invoice.html  example template
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

Body: `{ template, data, filename?, upload? }`. `upload: false` returns
`{ filename, base64 }` so you can verify the PDF without a live endpoint;
otherwise `{ filename, url }`. Missing `template` → 400. Request body limit 4mb.

## officeless config

| var | default | required | meaning |
|-----|---------|----------|---------|
| `OFFICELESS_UPLOAD_URL` | — | yes | endpoint |
| `OFFICELESS_TOKEN` | — | yes | bearer token |
| `OFFICELESS_FILE_FIELD` | `content` | no | JSON field for base64 |
| `OFFICELESS_NAME_FIELD` | `filename` | no | JSON field for name |
| `OFFICELESS_URL_PATH` | `url` | no | dot-path to URL in response |

Response shape is unconfirmed — if the URL nests (e.g. `data.url`), set
`OFFICELESS_URL_PATH` instead of editing code.

## Gotchas

- `printBackground: true` is mandatory or Tailwind backgrounds vanish.
- Fonts: render awaits `document.fonts.ready` + `networkidle0`.
- **Rebuild CSS after editing templates** — the compiler only keeps classes it sees.
- Multi-page breaks: use `break-inside-avoid` / `@page` rules in the template.
- Chromium in CI/sandbox: `PUPPETEER_SKIP_DOWNLOAD=1` lets install finish, but
  the render stage then needs a real Chromium at runtime.

## Deployment

- **Container:** bundle Chromium in the image.
- **Serverless:** swap `puppeteer` for `puppeteer-core` + `@sparticuz/chromium`
  — the bundled Chromium exceeds deploy size limits.

## Check

```bash
node test.js
```

Covers interpolation, CSS inlining, the officeless upload against a mock server
(fields, Bearer header, URL extraction, missing-path error), and a real PDF
render if Chromium is available.
