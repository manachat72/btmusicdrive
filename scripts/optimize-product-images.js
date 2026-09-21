const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const PRODUCT_FILE = path.join(ROOT, 'products.json');
const apply = process.argv.includes('--apply');
const slugArg = process.argv.find((arg) => arg.startsWith('--slug='));
const slug = slugArg ? slugArg.slice('--slug='.length) : 'usb-mp3-100-million-views-2';

async function main() {
  const products = JSON.parse(fs.readFileSync(PRODUCT_FILE, 'utf8'));
  const product = products.find((item) => item.slug === slug);
  if (!product) throw new Error(`Unknown product slug: ${slug}`);

  const refs = [...new Set([product.imageUrl, ...(product.images || [])].filter(Boolean))];
  const replacements = new Map();
  for (const ref of refs) {
    if (!/\.(png|jpe?g)$/i.test(ref)) continue;
    const source = path.join(ROOT, ref.replace(/^\//, ''));
    if (!fs.existsSync(source)) continue;
    const destination = source.replace(/\.(png|jpe?g)$/i, '.webp');
    const nextRef = ref.replace(/\.(png|jpe?g)$/i, '.webp');
    if (apply) {
      await sharp(source).webp({ quality: 80, effort: 6 }).toFile(destination);
    }
    replacements.set(ref, nextRef);
    const before = fs.statSync(source).size;
    const after = apply ? fs.statSync(destination).size : 0;
    console.log(`${path.basename(source)} -> ${path.basename(destination)} (${Math.round(before / 1024)} KiB${apply ? ` -> ${Math.round(after / 1024)} KiB` : ''})`);
  }

  if (!replacements.size) {
    console.log('No PNG/JPEG references need conversion.');
    return;
  }
  if (!apply) {
    console.log('Dry run only. Use --apply to convert and update products.json.');
    return;
  }

  product.imageUrl = replacements.get(product.imageUrl) || product.imageUrl;
  product.images = (product.images || []).map((ref) => replacements.get(ref) || ref);
  fs.writeFileSync(PRODUCT_FILE, `${JSON.stringify(products, null, 2)}\n`, 'utf8');
  console.log(`Updated ${replacements.size} image references for ${slug}. Original files were retained.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
