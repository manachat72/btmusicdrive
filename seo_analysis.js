const fs = require('fs');
const path = require('path');

const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));
for (const file of files) {
    if (file.includes('node_modules')) continue;
    const content = fs.readFileSync(file, 'utf8');
    
    // Check missing alt texts
    const imgRegex = /<img([^>]+)>/g;
    let imgMatch;
    let missingAltCount = 0;
    while ((imgMatch = imgRegex.exec(content)) !== null) {
        if (!imgMatch[1].includes('alt=')) {
            missingAltCount++;
        }
    }
    
    // Check Headings
    const h1Count = (content.match(/<h1/g) || []).length;
    const h2Count = (content.match(/<h2/g) || []).length;
    let hError = h1Count > 1 ? `Multiple H1 (${h1Count})` : (h1Count === 0 ? 'No H1' : 'OK');
    
    console.log(`${file} | Missing Alts: ${missingAltCount} | Headings: ${hError}`);
}
