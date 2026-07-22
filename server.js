import express from "express";
import { renderTemplate } from "./src/template.js";
import { htmlToPdf, closeBrowser } from "./src/pdf.js";
import { uploadToOfficeless } from "./src/officeless.js";

try {
  process.loadEnvFile(); // node >= 20.12, no dotenv needed
} catch {
  /* no .env file — rely on real env vars */
}

const app = express();
app.use(express.json({ limit: "4mb" }));

const ok = (res, message, data) => res.json({ error: false, message, data });
const fail = (res, status, message) =>
  res.status(status).json({ error: true, message, data: {} });

app.get("/health", (_req, res) => ok(res, "service is healthy", { ok: true }));

app.post("/generate", async (req, res) => {
  const { template, data = {}, filename, upload = true } = req.body || {};
  if (!template) return fail(res, 400, "template is required");

  const name = filename || `${template}-${Date.now()}.pdf`;
  try {
    const pdf = await htmlToPdf(await renderTemplate(template, data));
    const base64 = Buffer.from(pdf).toString("base64");
    if (upload === false) return ok(res, "PDF generated", { filename: name, base64 });
    const url = await uploadToOfficeless(base64, name);
    ok(res, "PDF generated and uploaded", { filename: name, url });
  } catch (err) {
    console.error(err);
    fail(res, 500, err.message);
  }
});

const port = process.env.PORT || 3000;
const server = app.listen(port, () => console.log(`listening on :${port}`));

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    await new Promise((r) => server.close(r)); // let in-flight renders finish
    await closeBrowser();
    process.exit(0);
  });
}
