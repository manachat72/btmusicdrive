const fs = require('fs');
const path = require('path');

function checkAssets() {
    const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.html'));
    let hasError = false;

    for (const file of files) {
        const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
        
        // Match <img src="X">
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
        let match;
        while ((match = imgRegex.exec(content)) !== null) {
            const src = match[1];
            if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('#')) continue;
            
            // local path
            const assetPath = path.join(__dirname, src.split('?')[0].split('#')[0]);
            if (!fs.existsSync(assetPath)) {
                console.log(`[!] Broken image in ${file}: ${src}`);
                hasError = true;
            }
        }

        // Match <link href="X"> primarily for css
        const linkRegex = /<link[^>]+href=["']([^"']+)["'][^>]*>/gi;
        while ((match = linkRegex.exec(content)) !== null) {
            const href = match[1];
            if (href.startsWith('http') || href.startsWith('data:') || href.startsWith('#')) continue;
            
            const assetPath = path.join(__dirname, href.split('?')[0].split('#')[0]);
            if (!fs.existsSync(assetPath)) {
                console.log(`[!] Broken link (CSS/Favicon) in ${file}: ${href}`);
                hasError = true;
            }
        }

        // Match <script src="X">
        const scriptRegex = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
        while ((match = scriptRegex.exec(content)) !== null) {
            const src = match[1];
            if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('#')) continue;
            
            const assetPath = path.join(__dirname, src.split('?')[0].split('#')[0]);
            if (!fs.existsSync(assetPath)) {
                console.log(`[!] Broken script in ${file}: ${src}`);
                hasError = true;
            }
        }

        // Match <a href="X">
        const aRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
        while ((match = aRegex.exec(content)) !== null) {
            const href = match[1];
            if (href.startsWith('http') || href.startsWith('data:') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
            
            // For simple local HTML file references without routing logic
            let cleanHref = href.split('?')[0].split('#')[0];
            if (cleanHref === '' || cleanHref === '/') continue; // assume root works

            const assetPath = path.join(__dirname, cleanHref);
            // Handle cases where the link might be to an html file but missing extension, though normally static site means .html is present
            if (!fs.existsSync(assetPath)) {
                 console.log(`[!] Broken anchor link in ${file}: ${href}`);
                 hasError = true;
            }
        }
    }
    
    if (!hasError) {
        console.log('No broken local links, images, or assets found!');
    } else {
        console.log('Asset check complete with errors.');
    }
}

checkAssets();
