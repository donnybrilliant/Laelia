#!/usr/bin/env node
/**
 * Generate PNG icons from public/icon.svg for PWA and Apple touch.
 * Run: node scripts/generate-icons.mjs
 * Requires: npm i -D @resvg/resvg-js
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const svgPath = join(root, 'public', 'icon.svg');
const outDir = join(root, 'public', 'icons');
const sizes = [180, 192, 512];

async function main() {
  const svg = await readFile(svgPath);
  await mkdir(outDir, { recursive: true });

  for (const size of sizes) {
    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } });
    const png = resvg.render().asPng();
    const outPath = join(outDir, `icon-${size}.png`);
    await writeFile(outPath, png);
    console.log(`Wrote ${outPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
