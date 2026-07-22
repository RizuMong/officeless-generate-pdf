import puppeteer from "puppeteer-core";

let browserPromise;

// Serverless hosts ship no Chrome and have a read-only filesystem, so puppeteer's
// downloaded copy is never in the bundle — use the lambda-packaged Chromium there.
// Locally, borrow the Chrome that's already installed instead of downloading a second one.
async function launch() {
  if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME)
    return puppeteer.launch({ channel: "chrome" });

  const { default: chromium } = await import("@sparticuz/chromium");
  return puppeteer.launch({
    args: chromium.args, // already includes --no-sandbox
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}

async function browser() {
  browserPromise ??= launch().catch((err) => {
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
