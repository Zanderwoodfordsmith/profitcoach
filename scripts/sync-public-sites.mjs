import fs from "node:fs";
import path from "node:path";

// Scrollcraft site builds served from public/. Locally each is a symlink; on the deploy it is absent, so copy it.
const SITES = [
  ["scrollcraft/builds/profit-coach-home-v2", "public/site-v2"],
  ["scrollcraft/builds/profit-coach-site-v3", "public/site-v3"],
  ["scrollcraft/builds/profit-coach-site-v4", "public/site-v4"],
];

const root = process.cwd();

for (const [from, to] of SITES) {
  const src = path.join(root, from);
  const dest = path.join(root, to);

  if (!fs.existsSync(src)) {
    console.error(`Missing ${from}`);
    process.exit(1);
  }

  try {
    const stat = fs.lstatSync(dest);
    if (stat.isSymbolicLink() && fs.realpathSync(dest) === fs.realpathSync(src)) continue;
  } catch {
    // Absent on the deploy. Copy the real folder below.
  }

  fs.cpSync(src, dest, { recursive: true });
}
