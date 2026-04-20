const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const sources = ['tailwind.min.css', 'style.min.css'];
const output = 'app.min.css';

const combined = sources
  .map(f => {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) throw new Error(`missing source: ${f}`);
    return `/* ${f} */\n${fs.readFileSync(p, 'utf8')}`;
  })
  .join('\n');

fs.writeFileSync(path.join(root, output), combined);

const size = fs.statSync(path.join(root, output)).size;
console.log(`${output}: ${(size / 1024).toFixed(1)}KB`);
