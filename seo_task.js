const fs = require('fs');
const path = require('path');

const privatePages = [
    'cart.html', 'checkout.html', 'orders.html', 
    'profile.html', 'address.html', 'wishlist.html', 'admin.html'
];
const BASE_URL = 'https://btmusicdrive.com';

function cleanRoute(file) {
    if (file === 'index.html') return '';
    return file.replace('.html', '');
}

async function runSeoTask() {
    const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));
    
    // Generate sitemap links
    const sitemapLinks = [];
    const today = new Date().toISOString().split('T')[0];

    for (const file of files) {
        if (file.includes('node_modules')) continue;
        let content = fs.readFileSync(file, 'utf8');

        // 1. Fix missing Alt tags
        content = content.replace(/<img(.*?)>/gi, (match, p1) => {
            if (!p1.toLowerCase().includes('alt=')) {
                // Determine alt type based on src
                if (p1.includes('logo')) {
                    return `<img${p1} alt="BT Music Drive Logo">`;
                } else {
                    return `<img${p1} alt="">`; // Decorative / tracking pixel
                }
            }
            return match;
        });

        // 2. Fix Multiple H1s
        let h1Count = 0;
        content = content.replace(/<h1(.*?)>(.*?)<\/h1>/gi, (match, attrs, inner) => {
            h1Count++;
            if (h1Count > 1) {
                return `<h2${attrs}>${inner}</h2>`;
            }
            return match;
        });

        // 3. Fix Missing H1
        const titleMatch = content.match(/<title>(.*?)<\/title>/i);
        const titleText = titleMatch ? titleMatch[1].split('—')[0].trim() : 'BT Music Drive';
        
        if (h1Count === 0) {
            // Find <main> block and inject invisible H1 for accessibility
            if (content.includes('<main')) {
                content = content.replace(/(<main[^>]*>)/i, `$1\n    <h1 class="sr-only">${titleText}</h1>`);
            } else if (content.includes('<body')) {
                content = content.replace(/(<body[^>]*>)/i, `$1\n    <h1 class="sr-only">${titleText}</h1>`);
            }
        }

        fs.writeFileSync(file, content);

        // Map to sitemap if public
        if (!privatePages.includes(file)) {
            const route = cleanRoute(file);
            const priority = route === '' ? '1.0' : (route === 'shop' || route.includes('product') ? '0.8' : '0.6');
            sitemapLinks.push(`  <url>\n    <loc>${BASE_URL}/${route}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`);
        }
    }

    // Wrap sitemap
    const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapLinks.join('\n')}
</urlset>`;
    
    fs.writeFileSync('sitemap.xml', sitemapContent);
    console.log('Processed HTML headers/alts and generated clean sitemap.xml.');

    // 4. Update robots.txt to strictly block vercel dynamic routes
    const robotsContent = `# robots.txt — BT Music Drive
# https://btmusicdrive.com

User-agent: *

# Block private / user-specific pages
Disallow: /admin
Disallow: /cart
Disallow: /checkout
Disallow: /orders
Disallow: /profile
Disallow: /address
Disallow: /wishlist
Disallow: /*.html$

# Block server-side and build artifacts
Disallow: /server/
Disallow: /images/

# Allow all other public pages
Allow: /

# Sitemap location
Sitemap: ${BASE_URL}/sitemap.xml
`;
    fs.writeFileSync('robots.txt', robotsContent);
    console.log('Updated robots.txt with strict pattern rules.');
}

runSeoTask();
