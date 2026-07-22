import puppeteer from "puppeteer";

let browserPromise;

const browser = () =>
  (browserPromise ??= puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  }));

export async function htmlToPdf(html, options = {}) {
  const page = await (await browser()).newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf({
      format: "A4",
      printBackground: true, // without this Tailwind backgrounds vanish
      margin: { top: "20px", right: "20px", bottom: "20px", left: "20px" },
      ...options,
    });
  } finally {
    await page.close();
  }
}

export async function closeBrowser() {
  if (!browserPromise) return;
  const b = browserPromise;
  browserPromise = undefined;
  await (await b).close();
}
