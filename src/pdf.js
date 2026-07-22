import puppeteer from "puppeteer";

let browserPromise;

// --no-sandbox only when the container runs as root; keep the sandbox otherwise
const args = process.env.PUPPETEER_NO_SANDBOX
  ? ["--no-sandbox", "--disable-setuid-sandbox"]
  : [];

async function browser() {
  browserPromise ??= puppeteer.launch({ args }).catch((err) => {
    browserPromise = undefined; // don't cache a failed launch forever
    throw err;
  });
  const b = await browserPromise;
  if (b.connected) return b;
  browserPromise = undefined; // crashed — relaunch
  return browser();
}

// ponytail: unbounded pages, add a small queue if concurrency ever spikes
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
