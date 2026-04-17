const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.html') && !f.includes('node_modules'));

for(const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  content = content.replace(/<a([^>]+)href=(["'])(http[^"']+)\2([^>]*)>/gi, (match, p1, p2, url, p3) => {
    // Only process if it doesn't already have target=
    if (!match.includes('target=')) {
        modified = true;
        // Make sure we append target="_blank" rel="noopener noreferrer"
        return `<a${p1}href=${p2}${url}${p2}${p3} target="_blank" rel="noopener noreferrer">`;
    }
    return match;
  });

  if (modified) {
    fs.writeFileSync(file, content);
    console.log(`Updated external links in ${file}`);
  }
}
console.log("Link check complete");
