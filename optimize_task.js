const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { execSync } = require('child_process');

async function getAllFiles(dir, exts) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(await getAllFiles(fullPath, exts));
    } else {
      if (exts.some(ext => fullPath.toLowerCase().endsWith(ext))) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

async function optimizeImages() {
  console.log('Optimizing images...');
  const imageFiles = await getAllFiles('./images', ['.png', '.jpg', '.jpeg']);
  
  for (const file of imageFiles) {
    const parsedPath = path.parse(file);
    const outputPath = path.join(parsedPath.dir, `${parsedPath.name}.webp`);
    
    try {
      await sharp(file)
        .webp({ quality: 80 })
        .toFile(outputPath);
      // Delete original
      fs.unlinkSync(file);
      console.log(`Converted ${file} to WebP constraints.`);
    } catch (err) {
      console.error(`Error processing ${file}:`, err);
    }
  }
  console.log('Images optimized successfully.');
}

async function updateFileContents() {
  console.log('Updating files contexts...');
  // Update JSON files
  const dataFiles = ['./products.json', './categories.json'];
  for (const file of dataFiles) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/\.png/gi, '.webp').replace(/\.jpg/gi, '.webp').replace(/\.jpeg/gi, '.webp');
    fs.writeFileSync(file, content);
  }

  // Update JS files that might contain image references
  const jsFiles = ['./script.js', './components.js', './checkout.js'];
  for (const file of jsFiles) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/\.png/gi, '.webp').replace(/\.jpg/gi, '.webp').replace(/\.jpeg/gi, '.webp');
    // Save original back before minification
    fs.writeFileSync(file, content);
  }

  // Update HTML files
  const htmlFiles = await getAllFiles('.', ['.html']);
  for (const file of htmlFiles) {
     if (file.includes('node_modules')) continue; // Skip node modules
     
     let content = fs.readFileSync(file, 'utf8');
     // Change images to webp
     content = content.replace(/\.png/gi, '.webp').replace(/\.jpg/gi, '.webp').replace(/\.jpeg/gi, '.webp');
     
     // Change JS and CSS to minified versions
     content = content.replace(/style\.css/g, 'style.min.css');
     content = content.replace(/script\.js/g, 'script.min.js');
     content = content.replace(/components\.js/g, 'components.min.js');
     content = content.replace(/checkout\.js/g, 'checkout.min.js');
     
     fs.writeFileSync(file, content);
  }
  console.log('Files contexts updated successfully.');
}

async function minifyCode() {
   console.log('Minifying CSS and JS...');
   try {
     execSync('npx cleancss -o style.min.css style.css');
     execSync('npx terser script.js -c -m -o script.min.js');
     execSync('npx terser components.js -c -m -o components.min.js');
     execSync('npx terser checkout.js -c -m -o checkout.min.js');
     console.log('CSS and JS minified successfully.');
   } catch (e) {
     console.error('Error minifying code:', e);
   }
}

async function run() {
  await optimizeImages();
  await updateFileContents();
  await minifyCode();
  console.log('Optimization process complete.');
}

run();
