import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceLogoPath = path.join(root, "public", "logo.webp");
const buildDir = path.join(root, "build");
const faviconPath = path.join(root, "public", "favicon.ico");
const electronIcoPath = path.join(buildDir, "icon.ico");
const electronPngPath = path.join(buildDir, "icon.png");
const iconSizes = [16, 24, 32, 48, 64, 128, 256];

async function pngBuffer(size: number) {
  return sharp(sourceLogoPath)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

function icoSizeByte(size: number) {
  return size >= 256 ? 0 : size;
}

function buildIco(images: Array<{ size: number; png: Buffer }>) {
  const headerSize = 6;
  const directorySize = images.length * 16;
  const header = Buffer.alloc(headerSize + directorySize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let imageOffset = headerSize + directorySize;
  for (const [index, image] of images.entries()) {
    const entryOffset = headerSize + index * 16;
    header.writeUInt8(icoSizeByte(image.size), entryOffset);
    header.writeUInt8(icoSizeByte(image.size), entryOffset + 1);
    header.writeUInt8(0, entryOffset + 2);
    header.writeUInt8(0, entryOffset + 3);
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(image.png.length, entryOffset + 8);
    header.writeUInt32LE(imageOffset, entryOffset + 12);
    imageOffset += image.png.length;
  }

  return Buffer.concat([header, ...images.map((image) => image.png)]);
}

async function main() {
  if (!fs.existsSync(sourceLogoPath)) {
    throw new Error(`Missing brand logo at ${sourceLogoPath}`);
  }

  fs.mkdirSync(buildDir, { recursive: true });

  const images = await Promise.all(iconSizes.map(async (size) => ({ size, png: await pngBuffer(size) })));
  const icon = buildIco(images);
  fs.writeFileSync(faviconPath, icon);
  fs.writeFileSync(electronIcoPath, icon);
  fs.writeFileSync(electronPngPath, await pngBuffer(256));
  console.log(`Generated icons from ${path.relative(root, sourceLogoPath)}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
