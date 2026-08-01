/**
 * Regenerate sidebar-betandyou.webp from the source PNG (after replacing creatives).
 */
import sharp from "sharp";
import path from "path";

const root = process.cwd();
const src = path.join(root, "public/promos/sidebar-betandyou-source.png");
const dest = path.join(root, "public/promos/sidebar-betandyou.webp");

await sharp(src).webp({ quality: 86 }).toFile(dest);
console.log("Written", dest);
