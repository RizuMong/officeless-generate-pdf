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
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/generate", async (req, res) => {
  const { template, data = {}, filename, upload = true } = req.body || {};
  if (!template) return res.status(400).json({ error: "template is required" });

  const name = filename || `${template}-${Date.now()}.pdf`;
  try {
    const pdf = await htmlToPdf(await renderTemplate(template, data));
    const base64 = Buffer.from(pdf).toString("base64");
    if (upload === false) return res.json({ filename: name, base64 });
    res.json({ filename: name, url: await uploadToOfficeless(base64, name) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 3000;
const server = app.listen(port, () => console.log(`listening on :${port}`));

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    server.close();
    await closeBrowser();
    process.exit(0);
  });
}
