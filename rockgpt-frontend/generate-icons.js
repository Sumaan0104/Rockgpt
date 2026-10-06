import fs from "fs";
import path from "path";
import sharp from "sharp";

const LOGO_D = "M130.8 0.0L0.0 225.8L0.0 229.0L130.5 454.8L246.2 454.8L220.8 410.5L157.0 409.2L52.5 228.2L158.5 44.5L191.2 44.8L208.2 74.5L118.5 230.8L189.0 353.8L216.0 354.5L323.8 168.8L355.2 223.2L265.0 381.2L307.2 454.8L395.2 454.8L525.8 229.2L525.8 226.0L395.0 0.0L279.5 0.0L305.0 44.2L367.2 44.5L473.5 227.0L368.8 409.2L336.8 410.5L333.8 409.2L317.5 380.0L407.2 222.8L336.8 100.8L310.5 100.0L202.0 286.0L170.8 231.2L261.0 74.2L218.2 0.0Z";

function makeSvg(size, ratio = 0.55) {
  const w = Math.round(size * ratio);
  const h = Math.round(w * (455 / 526));
  const x = Math.round((size - w) / 2);
  const y = Math.round((size - h) / 2);
  const scale = w / 526;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="#000000"/>
    <g transform="translate(${x}, ${y}) scale(${scale})">
      <path d="${LOGO_D}" fill="#ffffff"/>
    </g>
  </svg>`;
}

async function generate() {
  const publicDir = path.resolve("public");
  const iconsDir = path.resolve("public/icons");

  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  // 1. icon-192.png (both in /icons and /)
  const svg192 = Buffer.from(makeSvg(192, 0.55));
  await sharp(svg192).png().toFile(path.join(iconsDir, "icon-192.png"));
  await sharp(svg192).png().toFile(path.join(publicDir, "icon-192.png"));
  console.log("✓ Generated icon-192.png");

  // 2. icon-512.png (both in /icons and /)
  const svg512 = Buffer.from(makeSvg(512, 0.55));
  await sharp(svg512).png().toFile(path.join(iconsDir, "icon-512.png"));
  await sharp(svg512).png().toFile(path.join(publicDir, "icon-512.png"));
  console.log("✓ Generated icon-512.png");

  // 3. maskable-512.png (with safe-zone ~50% padding for Android adaptive icon)
  const svgMaskable = Buffer.from(makeSvg(512, 0.50));
  await sharp(svgMaskable).png().toFile(path.join(iconsDir, "maskable-512.png"));
  console.log("✓ Generated maskable-512.png");

  // 4. apple-touch-icon.png (180x180)
  const svg180 = Buffer.from(makeSvg(180, 0.55));
  await sharp(svg180).png().toFile(path.join(publicDir, "apple-touch-icon.png"));
  console.log("✓ Generated apple-touch-icon.png");
}

generate().catch(console.error);
