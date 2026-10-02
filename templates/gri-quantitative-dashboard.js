// GRI quantitative dashboard — A4 landscape, zero remote assets, no recalculation of widget values.
// Contract: render(data) -> full HTML document, pdfOptions(data) -> puppeteer page.pdf() overrides.
// Every string from `data` goes through esc(); numbers go through fmtNum(). Nothing is eval'd.

const C = {
  primary: "#4B61DC", text: "#272B32", text2: "#4C5460", text3: "#656F80",
  border: "#DCDFE4", soft: "#F0F1F3", green: "#1C8459", red: "#C33E35", amber: "#D9902A",
};
const PALETTE = ["#4B61DC", "#0E8C82", "#D9902A", "#7586E5", "#C33E35", "#23A06B", "#242F6A", "#B2B9C4"];
const FONT = "Inter, Arial, Helvetica, sans-serif";
const SPAN = { QUARTER: 1, HALF: 2, FULL: 4 };
const GROUP_HEADER = { ENTITY: "Entity", PERIOD: "Year" }; // anything else -> "Row"

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
const str = (s) => (typeof s === "string" || typeof s === "number" ? String(s) : "");
const obj = (o) => (o && typeof o === "object" && !Array.isArray(o) ? o : {});

// null / "" / NaN / Infinity -> null, so "–" is the only fallback
const num = (v) =>
  (typeof v === "number" || (typeof v === "string" && v.trim() !== "")) && Number.isFinite(Number(v))
    ? Number(v)
    : null;

function fmtNum(v, d) {
  const n = num(v);
  if (n === null) return "–";
  const s = n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  return /^-0(\.0+)?$/.test(s) ? s.slice(1) : s; // "-0" after rounding
}
const isPct = (u) => u === "%" || /^percent(age)?$/i.test(u);
// [number, suffix] so the KPI can style the unit separately
const parts = (v, w) => {
  const s = fmtNum(v, w.d);
  return s === "–" ? [s, ""] : [s, isPct(w.unit) ? "%" : w.unit ? ` ${w.unit}` : ""];
};
const fmt = (v, w) => parts(v, w).join("");

// ---------- widget bodies ----------

const empty = (msg) => `<div class="box dashed">${esc(msg)}</div>`;

function kpi(w) {
  const [n, suffix] = parts(w.groups[0]?.value, w);
  let delta = "";
  const dl = obj(w.delta);
  const pct = num(dl.pct);
  const t = obj(w.target);
  const tv = num(t.value);
  const lower = t.direction === "LOWER_IS_BETTER";
  if (pct !== null) {
    const color = tv === null || pct === 0 ? C.text3 : (pct < 0) === lower ? C.green : C.red;
    const arrow =
      pct === 0
        ? `<rect x="1" y="5" width="10" height="2" fill="${color}"/>`
        : pct > 0
          ? `<polygon points="6,1 11,10 1,10" fill="${color}"/>`
          : `<polygon points="6,11 11,2 1,2" fill="${color}"/>`;
    delta = `<div class="delta" style="color:${color}"><svg width="12" height="12" viewBox="0 0 12 12">${arrow}</svg>
      ${esc(fmtNum(Math.abs(pct), 1))}%${dl.period != null ? ` vs ${esc(dl.period)}` : ""}</div>`;
  }
  let target = "";
  if (tv !== null) {
    const v = num(w.groups[0]?.value);
    const on = typeof t.on_track === "boolean" ? t.on_track : v === null ? null : lower ? v <= tv : v >= tv;
    const pill =
      on === null ? "" : `<span class="pill" style="background:${on ? C.green : C.red}">${on ? "On track" : "Off track"}</span>`;
    target = `<div class="target">${pill}<span>Target ${lower ? "≤" : "≥"} ${esc(fmt(tv, w))}</span></div>`;
  }
  return `<div class="kpi"><div class="kpi-v">${esc(n)}<span class="kpi-u">${esc(suffix)}</span></div>${delta}${target}</div>`;
}

function bars(w, ranked) {
  const max = Math.max(0, ...w.groups.map((g) => Math.abs(num(g.value) ?? 0)));
  return `<div class="bars">${w.groups
    .map((g, i) => {
      const v = num(g.value);
      const width = v === null || !max ? 0 : (Math.abs(v) / max) * 100;
      return `<div class="bar-row${ranked ? " ranked" : ""}">
        ${ranked ? `<span class="rank">${i + 1}</span>` : ""}
        <span class="bar-l">${esc(g.label)}</span>
        <span class="track"><span class="fill" style="width:${width.toFixed(2)}%;background:${v !== null && v < 0 ? C.red : C.primary}"></span></span>
        <span class="bar-v">${esc(fmt(g.value, w))}</span></div>`;
    })
    .join("")}</div>`;
}

function trend(w) {
  const pts = w.groups.map((g) => ({ label: str(g.label), v: num(g.value) }));
  if (!pts.some((p) => p.v !== null)) return empty("No data");
  const tv = num(obj(w.target).value);
  const vals = [...pts.map((p) => p.v), tv].filter((v) => v !== null);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const W = 640, H = 220, L = 28, R = 28, T = 34, B = 36;
  const x = (i) => (pts.length === 1 ? W / 2 : L + (i * (W - L - R)) / (pts.length - 1));
  const y = (v) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const small = pts.length > 10;
  const fs = small ? 9 : 12;
  let d = "";
  let pen = false;
  pts.forEach((p, i) => {
    if (p.v === null) { pen = false; return; }
    d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`;
    pen = true;
  });
  const dots = pts
    .map((p, i) =>
      p.v === null
        ? ""
        : `<circle cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="4" fill="${C.primary}"/>
           <text x="${x(i).toFixed(1)}" y="${(y(p.v) - 10).toFixed(1)}" text-anchor="middle" font-size="${fs}" font-weight="600" fill="${C.text}">${esc(fmtNum(p.v, w.d))}${isPct(w.unit) ? "%" : ""}</text>`,
    )
    .join("");
  const xl = pts
    .map((p, i) => `<text x="${x(i).toFixed(1)}" y="${H - 12}" text-anchor="middle" font-size="${fs}" fill="${C.text3}">${esc(p.label.length > 12 ? p.label.slice(0, 11) + "…" : p.label)}</text>`)
    .join("");
  const target =
    tv === null
      ? ""
      : `<line x1="${L}" x2="${W - R}" y1="${y(tv).toFixed(1)}" y2="${y(tv).toFixed(1)}" stroke="${C.amber}" stroke-width="1.5" stroke-dasharray="6 4"/>
         <text x="${W - R}" y="${(y(tv) - 5).toFixed(1)}" text-anchor="end" font-size="10" fill="${C.amber}">Target ${esc(fmtNum(tv, w.d))}${isPct(w.unit) ? "%" : ""}</text>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <line x1="${L}" x2="${W - R}" y1="${H - B + 6}" y2="${H - B + 6}" stroke="${C.border}"/>
    ${target}<path d="${d}" fill="none" stroke="${C.primary}" stroke-width="2"/>${dots}${xl}</svg>`;
}

function pie(w, donut) {
  const items = w.groups.map((g, i) => ({ g, v: num(g.value), color: PALETTE[i % PALETTE.length] }));
  const slices = items.filter((s) => s.v !== null && s.v > 0);
  const total = slices.reduce((a, s) => a + s.v, 0);
  if (!total) return empty("All values are 0, so there is nothing to split yet.");
  const r = donut ? 56 : 40;
  const sw = donut ? 28 : 80;
  const circ = 2 * Math.PI * r;
  let cum = 0;
  const arcs = slices
    .map((s) => {
      const len = (s.v / total) * circ;
      const el = `<circle cx="80" cy="80" r="${r}" fill="none" stroke="${s.color}" stroke-width="${sw}" stroke-dasharray="${len.toFixed(2)} ${(circ - len).toFixed(2)}" stroke-dashoffset="${(-cum).toFixed(2)}" transform="rotate(-90 80 80)"/>`;
      cum += len;
      return el;
    })
    .join("");
  const t = fmtNum(total, w.d);
  const centre = donut
    ? `<text x="80" y="${w.unit ? 80 : 85}" text-anchor="middle" font-size="${t.length > 9 ? 13 : t.length > 6 ? 16 : 20}" font-weight="700" fill="${C.text}">${esc(t)}</text>${
        w.unit ? `<text x="80" y="96" text-anchor="middle" font-size="10" fill="${C.text3}">${esc(w.unit)}</text>` : ""
      }`
    : "";
  const legend = items
    .map((s) => `<li><i style="background:${s.color}"></i><span class="lg-l">${esc(s.g.label)}</span>
      <span class="lg-v">${esc(fmt(s.g.value, w))}</span><span class="lg-p">${s.v !== null && s.v > 0 ? esc(fmtNum((s.v / total) * 100, 1)) + "%" : "–"}</span></li>`)
    .join("");
  return `<div class="pie"><svg viewBox="0 0 160 160" width="150" height="150" xmlns="http://www.w3.org/2000/svg">${arcs}${centre}</svg><ul class="legend">${legend}</ul></div>`;
}

function table(w) {
  const first = GROUP_HEADER[w.group_by] ?? "Row";
  const head = `Value${w.unit ? ` (${esc(w.unit)})` : ""}`;
  return `<table><thead><tr><th>${first}</th><th class="r">${head}</th></tr></thead><tbody>${w.groups
    .map((g) => `<tr><td>${esc(g.label)}</td><td class="r">${esc(fmtNum(g.value, w.d))}</td></tr>`)
    .join("")}</tbody></table>`;
}

const BODY = {
  KPI: kpi,
  BAR: (w) => bars(w, false),
  RANKING: (w) => bars(w, true),
  TREND: trend,
  DONUT: (w) => pie(w, true),
  PIE: (w) => pie(w, false),
  TABLE: table,
};

// ---------- card ----------

function meta(w) {
  const bits = [];
  let period = w.period != null ? str(w.period) : "";
  if (!period && w.type === "TREND" && w.groups.length > 1)
    period = `${str(w.groups[0].label)}–${str(w.groups[w.groups.length - 1].label)}`;
  if (period) bits.push(`Period ${esc(period)}`);
  const cov = obj(w.coverage);
  if (num(cov.n) !== null && num(cov.m) !== null) bits.push(`Coverage ${esc(cov.n)} of ${esc(cov.m)} entities`);
  if (w.unit) bits.push(`Unit ${esc(w.unit)}`);
  const notes = (Array.isArray(w.notes) ? w.notes : []).map(str).filter(Boolean);
  if (!bits.length && !notes.length) return "";
  return `<div class="meta">${bits.join(" · ")}${notes.map((n) => `<div>${esc(n)}</div>`).join("")}</div>`;
}

function card(raw) {
  const decimals = Math.min(6, Math.max(0, Math.trunc(Number(raw.decimals)) || 0));
  const w = {
    ...raw,
    d: decimals,
    unit: str(raw.unit),
    groups: (Array.isArray(raw.groups) ? raw.groups : []).map(obj),
  };
  const status = str(w.status) || "ok";
  const msgs = (Array.isArray(w.messages) ? w.messages : []).map(str).filter(Boolean);
  const span = SPAN[w.width] ?? 1;
  const long = w.type === "TABLE" && span === 4; // only FULL tables may break across pages
  let body;
  let showMeta = false;
  if (status === "empty") body = empty(msgs[0] ?? "No data yet");
  else if (status !== "ok")
    body = `<div class="box warn"><b>${status === "invalid" ? "Not complete yet" : "Needs review"}</b>${
      msgs.length ? `<ul>${msgs.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : ""
    }</div>`;
  else if (!BODY[w.type]) body = `<div class="box warn"><b>Not supported</b><div>Widget type “${esc(w.type)}” cannot be printed.</div></div>`;
  else if (!w.groups.length) body = empty("No data yet");
  else {
    body = BODY[w.type](w);
    showMeta = true;
  }
  return `<section class="card${long ? " long" : ""}" style="grid-column:span ${span}">
    <h3>${esc(w.title) || "Untitled"}</h3>${w.source ? `<div class="src">${esc(w.source)}</div>` : ""}
    <div class="body">${body}</div>${showMeta ? meta(w) : ""}</section>`;
}

// ---------- page ----------

const CSS = `
@page{size:A4 landscape;margin:12mm}
*{box-sizing:border-box}
html,body{margin:0;background:#fff;color:${C.text};font:11px/1.4 ${FONT};-webkit-print-color-adjust:exact;print-color-adjust:exact}
h1{font-size:20px;margin:0}
.dn{font-size:14px;font-weight:600;margin-top:2px}
.desc{white-space:pre-line;color:${C.text2};margin-top:4px;max-width:70%}
.hmeta{color:${C.text3};font-size:10px;margin-top:6px}
.hmeta span+span::before{content:" · "}
header{border-bottom:2px solid ${C.primary};padding-bottom:8px;margin-bottom:10px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.card{border:1px solid ${C.border};border-radius:8px;padding:10px 12px;background:#fff;break-inside:avoid;display:flex;flex-direction:column;min-width:0;overflow-wrap:anywhere}
.card.long{break-inside:auto}
h3{font-size:12px;margin:0;break-after:avoid}
.src{color:${C.text3};font-size:9.5px;margin-top:1px}
.body{margin:8px 0;flex:1}
.meta{border-top:1px solid ${C.soft};padding-top:5px;color:${C.text3};font-size:9px}
.box{border-radius:6px;padding:10px;color:${C.text2}}
.dashed{border:1px dashed ${C.border}}
.warn{border:1px solid ${C.amber};background:#FDF6EA}
.warn ul{margin:4px 0 0;padding-left:16px}
.kpi-v{font-size:26px;font-weight:700;line-height:1.1}
.kpi-u{font-size:12px;font-weight:600;color:${C.text3}}
.delta{display:flex;align-items:center;gap:4px;font-weight:600;margin-top:4px}
.target{margin-top:6px;display:flex;align-items:center;gap:6px;color:${C.text2}}
.pill{color:#fff;border-radius:99px;padding:1px 8px;font-size:9.5px;font-weight:600}
.bar-row{display:grid;grid-template-columns:minmax(0,34%) 1fr auto;align-items:center;gap:8px;margin:5px 0}
.bar-row.ranked{grid-template-columns:18px minmax(0,34%) 1fr auto}
.rank{background:${C.primary};color:#fff;border-radius:99px;width:18px;height:18px;text-align:center;font-size:9.5px;line-height:18px;font-weight:600}
.track{height:10px;background:${C.soft};border-radius:5px;overflow:hidden;display:block}
.fill{display:block;height:100%}
.bar-v{font-weight:600;white-space:nowrap}
.chart{width:100%;height:auto;display:block;font-family:${FONT}}
.pie{display:flex;gap:14px;align-items:center}
.pie svg{flex:none;font-family:${FONT}}
.legend{list-style:none;margin:0;padding:0;flex:1;min-width:0}
.legend li{display:grid;grid-template-columns:10px minmax(0,1fr) auto 44px;gap:6px;align-items:center;margin:3px 0}
.legend i{width:10px;height:10px;border-radius:2px}
.lg-v{font-weight:600;white-space:nowrap}.lg-p{text-align:right;color:${C.text3}}
table{width:100%;border-collapse:collapse}
thead{display:table-header-group}
th{text-align:left;background:${C.soft};font-size:10px;color:${C.text2}}
th,td{padding:4px 8px;border-bottom:1px solid ${C.soft}}
tr{break-inside:avoid}
.r{text-align:right}
`;

function header(data) {
  const d = obj(data.dashboard);
  const ver = [
    d.version != null ? `Version ${esc(d.version)}` : "",
    d.published_by ? `Published by ${esc(d.published_by)}` : "",
    d.published_at ? esc(d.published_at) : "",
  ].filter(Boolean);
  const spans = (xs) => xs.filter(Boolean).map((x) => `<span>${x}</span>`).join("");
  return `<header><h1>${esc(data.report_title) || "GRI Quantitative Report"}</h1>
    ${d.name ? `<div class="dn">${esc(d.name)}</div>` : ""}
    ${d.description ? `<div class="desc">${esc(d.description)}</div>` : ""}
    <div class="hmeta">${spans([
      d.scope_label ? `Scope: ${esc(d.scope_label)}` : "",
      data.filter_summary ? `Filters: ${esc(data.filter_summary)}` : "",
      data.generated_at ? `Generated ${esc(data.generated_at)}` : "",
      data.generated_by ? `by ${esc(data.generated_by)}` : "",
    ])}</div>
    ${ver.length ? `<div class="hmeta">${spans(ver)}</div>` : ""}</header>`;
}

export function render(raw) {
  const data = obj(raw);
  const widgets = (Array.isArray(data.widgets) ? data.widgets : [])
    .map((w, i) => ({ w: obj(w), i }))
    .sort((a, b) => (num(a.w.order) ?? Infinity) - (num(b.w.order) ?? Infinity) || a.i - b.i)
    .map(({ w }) => card(w))
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(data.report_title) || "GRI Quantitative Report"}</title>
<style>${CSS}</style></head><body>${header(data)}<main class="grid">${widgets}</main></body></html>`;
}

export function pdfOptions(raw) {
  const data = obj(raw);
  const cls = esc(str(data.classification) || "INTERNAL");
  const s = `font-family:Arial,Helvetica,sans-serif;font-size:8px;color:${C.text3}`;
  return {
    format: "A4",
    landscape: true,
    margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
    displayHeaderFooter: true,
    headerTemplate: "<div></div>",
    footerTemplate: `<div style="${s};width:100%;padding:0 12mm;display:flex;justify-content:space-between">
      <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      <span>${cls}</span><span>${esc(data.generated_at)}</span></div>`,
  };
}
