// Genera los íconos PNG de la PWA a partir de un SVG (logo "F" sobre teal).
// Uso: node scripts/gen-icons.mjs   (requiere sharp instalado)
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public");

const TEAL = "#1E6E69";
const CREAM = "#F3EEE5";

// SVG de 512x512. `rx` redondea las esquinas; `fScale` escala la "F".
function svg({ rx = 0, fScale = 1 }) {
  // Geometría de la "F" centrada en el lienzo de 512.
  const W = 154,
    H = 236,
    stem = 61,
    bar = 54,
    midW = 123,
    midBar = 52;
  const left = (512 - W) / 2;
  const top = (512 - H) / 2;
  const cx = 256,
    cy = 256;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${rx}" ry="${rx}" fill="${TEAL}"/>
  <g transform="translate(${cx} ${cy}) scale(${fScale}) translate(${-cx} ${-cy})" fill="${CREAM}">
    <rect x="${left}" y="${top}" width="${stem}" height="${H}" rx="8"/>
    <rect x="${left}" y="${top}" width="${W}" height="${bar}" rx="8"/>
    <rect x="${left}" y="${top + 91}" width="${midW}" height="${midBar}" rx="8"/>
  </g>
</svg>`;
}

async function render(svgStr, size, file) {
  await sharp(Buffer.from(svgStr))
    .resize(size, size)
    .png()
    .toFile(join(outDir, file));
  console.log("  ✓", file);
}

await mkdir(outDir, { recursive: true });
console.log("Generando íconos...");
await render(svg({ rx: 112, fScale: 1 }), 192, "icon-192.png");
await render(svg({ rx: 112, fScale: 1 }), 512, "icon-512.png");
await render(svg({ rx: 0, fScale: 0.72 }), 512, "icon-maskable-512.png");
await render(svg({ rx: 0, fScale: 0.84 }), 180, "apple-touch-icon.png");
await render(svg({ rx: 96, fScale: 1 }), 32, "favicon.png");
console.log("Listo.");
