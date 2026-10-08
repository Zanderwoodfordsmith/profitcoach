import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const src = path.join(root, "scrollcraft/builds/profit-coach-home-v2");
const dest = path.join(root, "public/site-v2");

if (!fs.existsSync(src)) {
  console.error("Missing scrollcraft/builds/profit-coach-home-v2");
  process.exit(1);
}

try {
  const stat = fs.lstatSync(dest);
  if (stat.isSymbolicLink() && fs.realpathSync(dest) === fs.realpathSync(src)) {
    process.exit(0);
  }
} catch {
  // public/site-v2 is absent on the deploy. Copy the real folder below.
}

fs.cpSync(src, dest, { recursive: true });
