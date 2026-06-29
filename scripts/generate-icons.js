import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sizes = [16, 32, 48, 128];
const svgPath = path.resolve(__dirname, '../public/favicon.svg');

async function generate() {
  console.log(`Reading SVG from: ${svgPath}`);
  const svgBuffer = fs.readFileSync(svgPath);

  for (const size of sizes) {
    const destPath = path.resolve(__dirname, `../public/icon-${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(destPath);
    console.log(`Generated: public/icon-${size}.png`);
  }
}

generate().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
