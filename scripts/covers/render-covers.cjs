// Render each cover .html in a folder to a .jpg at 1536 x 864.
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

(async () => {
  const dir = process.argv[2];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1536, height: 864 } });
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".html"))) {
    await page.goto("file://" + path.join(dir, f));
    await page.screenshot({ path: path.join(dir, f.replace(".html", ".jpg")), type: "jpeg", quality: 86 });
    console.log(f);
  }
  await browser.close();
})();
