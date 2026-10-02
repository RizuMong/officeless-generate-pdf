// One-off generator for examples/gri-edge-cases/*.json (kept so fixtures can be regenerated).
import { writeFileSync } from "node:fs";
const base = (widgets, over = {}) => ({
  template: "gri-quantitative-dashboard", filename: "edge.pdf", upload: false,
  data: {
    classification: "INTERNAL", report_title: "GRI Quantitative Report",
    generated_at: "2 Oct 2026, 14:05 WIB", generated_by: "Holding User",
    filter_summary: "All entities in scope",
    dashboard: { id: "d", name: "Edge case", description: "Line 1\nLine 2", version: 1, published_by: "Admin", published_at: "1 Oct 2026", scope_label: "All" },
    widgets, ...over,
  },
});
const w = (o) => ({ status: "ok", unit: "t", decimals: 1, period: 2025, coverage: { n: 1, m: 2 }, notes: [], ...o });
const g = (label, value, i) => ({ key: String(i), label, value });
const out = {
  "table-60-rows": base([
    w({ id: "k", order: 1, type: "KPI", width: "QUARTER", title: "Rows", source: "x", groups: [g("_", 60)] }),
    w({ id: "t", order: 2, type: "TABLE", width: "FULL", group_by: "ENTITY", title: "Headcount per entity", source: "2-7", groups: Array.from({ length: 60 }, (_, i) => g(`Entity ${i + 1}`, 1000 + i * 37.5, i)) }),
  ]),
  "long-labels": base([
    w({ id: "b", order: 1, type: "BAR", width: "HALF", title: "A very long widget title that keeps going to check wrapping inside the card header area", source: "a-very-long-source-name-without-spaces-302-1-Actual-Total-Consumption", groups: [g("Subsidiary with an extremely long legal name Tbk PT Contoh Nusantara Sejahtera Abadi", 120, 1), g("Supercalifragilisticexpialidocious_no_spaces_label_that_never_ends", 80, 2)] }),
    w({ id: "d", order: 2, type: "DONUT", width: "HALF", title: "Mix", source: "x", groups: [g("Non-renewable electricity purchased from the national grid operator", 70, 1), g("Renewable on-site solar generation and certificates (RECs)", 30, 2)] }),
    w({ id: "t", order: 3, type: "TREND", width: "FULL", title: "Many points", source: "x", period: null, groups: Array.from({ length: 14 }, (_, i) => g(`FY ${2012 + i} restated`, 40 + ((i * 7) % 13), i)) }),
  ]),
  "negative-values": base([
    w({ id: "k", order: 1, type: "KPI", width: "QUARTER", title: "Net change", source: "x", unit: "%", groups: [g("_", -12.54, 1)], delta: { period: 2024, pct: 0 }, target: { value: 0, direction: "HIGHER_IS_BETTER" } }),
    w({ id: "b", order: 2, type: "BAR", width: "HALF", title: "Variance", source: "x", groups: [g("A", -50, 1), g("B", 100, 2), g("C", -25.55, 3)] }),
    w({ id: "t", order: 3, type: "TREND", width: "HALF", title: "Net trend", source: "x", period: null, groups: [g("2023", -5, 1), g("2024", 3, 2), g("2025", -1.2, 3)], target: { value: 0, direction: "HIGHER_IS_BETTER" } }),
    w({ id: "p", order: 4, type: "PIE", width: "HALF", title: "Pie with negative", source: "x", groups: [g("Up", 60, 1), g("Down", -20, 2), g("Missing", null, 3)] }),
    w({ id: "tb", order: 5, type: "TABLE", width: "HALF", group_by: "PERIOD", title: "Table", source: "x", groups: [g("2024", -1500.5, 1), g("2025", null, 2)] }),
  ]),
  "all-zero-donut": base([
    w({ id: "d", order: 1, type: "DONUT", width: "HALF", title: "Zero donut", source: "x", groups: [g("A", 0, 1), g("B", 0, 2)] }),
    w({ id: "p", order: 2, type: "PIE", width: "HALF", title: "Zero pie", source: "x", groups: [g("A", 0, 1)] }),
  ]),
  "html-injection": base(
    [
      w({ id: "x", order: 1, type: "BAR", width: "HALF", title: "<script>alert(1)</script> \"quoted\" & <img src=x onerror=alert(2)>", source: "<b>src</b>\" onmouseover=\"alert(3)", groups: [g("<script>alert('l')</script>", 5, 1), g("\"><svg onload=alert(4)>", 3, 2)], notes: ["<script>alert('n')</script>"] }),
      w({ id: "y", order: 2, type: "DONUT", width: "HALF", title: "t", source: "s", unit: "<u>", groups: [g("</text><script>alert(5)</script>", 5, 1)] }),
      w({ id: "z", order: 3, type: "KPI", width: "QUARTER", title: "w", source: "s", status: "warning", messages: ["<script>alert(6)</script>"], groups: [] }),
      w({ id: "u", order: 4, type: "<script>alert(7)</script>", width: "QUARTER", title: "t", source: "s", groups: [g("a", 1, 1)] }),
    ],
    {},
  ),
  "missing-optional": { template: "gri-quantitative-dashboard", upload: false, data: { widgets: [
    { id: "a", type: "KPI", title: "Only title and type" },
    { id: "b", type: "BAR", title: "Groups without labels", groups: [{ value: 3 }, { label: "x" }, null] },
    { id: "c", type: "TREND", title: "One point", groups: [{ label: "2025", value: 4 }] },
    { id: "d", type: "TABLE", status: "ok", groups: [{ label: "r", value: "12.345" }] },
    { id: "e", type: "KPI", title: "Bad delta/target", groups: [{ value: "abc" }], delta: "oops", target: [], coverage: { n: 1 } },
  ] } },
  "unknown-type": base([
    w({ id: "u", order: 1, type: "GAUGE", width: "HALF", title: "Gauge", source: "x", groups: [g("a", 1, 1)] }),
    w({ id: "k", order: 2, type: "KPI", width: "QUARTER", title: "Still renders", source: "x", groups: [g("_", 7, 1)] }),
  ]),
};
for (const [name, body] of Object.entries(out))
  writeFileSync(new URL(`../examples/gri-edge-cases/${name}.json`, import.meta.url), JSON.stringify(body, null, 2) + "\n");
