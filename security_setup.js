const fs = require('fs');
const path = require('path');

// 1. Update vercel.json
const vercelPath = 'vercel.json';
const vercelConfig = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));

// Inject HSTS globally
vercelConfig.headers.unshift({
  source: "/(.*)",
  headers: [
    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" }
  ]
});

// Rename /admin -> /bt-admin
const htmlRoutesIndex = vercelConfig.routes.findIndex(r => r.src && r.src.includes('(shop|cart|'));
if (htmlRoutesIndex !== -1) {
  let route = vercelConfig.routes[htmlRoutesIndex];
  route.src = route.src.replace('|admin)', ')'); // remove admin
}
vercelConfig.routes.splice(htmlRoutesIndex, 0, { src: "/bt-admin", dest: "/bt_panel_secure.html" });

fs.writeFileSync(vercelPath, JSON.stringify(vercelConfig, null, 2));
console.log('Updated vercel.json');

// 2. Rename Admin file
if (fs.existsSync('admin.html')) {
  fs.renameSync('admin.html', 'bt_panel_secure.html');
  console.log('Renamed admin.html to bt_panel_secure.html');
}

// 3. Update checkout.html (Honeypot)
let checkoutHtml = fs.readFileSync('checkout.html', 'utf8');
const checkoutHoneypot = `
                <!-- Security Honeypot -->
                <div style="display:none;" aria-hidden="true" tabindex="-1">
                    <label for="order-confirm-token">Token</label>
                    <input type="text" id="order-confirm-token" name="order-confirm-token" autocomplete="off" tabindex="-1">
                </div>
`;
// Inject after <div class="lg:col-span-7 space-y-6">
checkoutHtml = checkoutHtml.replace(/(<div class="lg:col-span-7 space-y-6">)/, `$1${checkoutHoneypot}`);
fs.writeFileSync('checkout.html', checkoutHtml);

// Update checkout.js logic
let checkoutJs = fs.readFileSync('checkout.js', 'utf8');
const honeypotLogic = `
    const honeypot = document.getElementById('order-confirm-token');
    if (honeypot && honeypot.value) {
        // Bot trap
        showCheckoutError("ระบบตรวจพบสแปม กรุณาลองใหม่ในภายหลัง");
        return;
    }
`;
// Inject at the beginning of placeOrder()
checkoutJs = checkoutJs.replace(/async function placeOrder\(\) \{/, `async function placeOrder() {${honeypotLogic}`);
fs.writeFileSync('checkout.js', checkoutJs);

console.log('Updated checkout logic and honeypot');

// 4. Strong Password Generation (Fake for env)
let envContent = fs.readFileSync('server/.env', 'utf8');
// Generate high entropy password
const crypto = require('crypto');
const newAdminPass = "BtM$c@Admin_2026!Px" + crypto.randomBytes(4).toString('hex');
envContent = envContent.replace(/(ADMIN_PASSWORD=")(.*?)"/, `$1${newAdminPass}"`);
fs.writeFileSync('server/.env', envContent);
console.log('Admin password updated to ' + newAdminPass);

// Optional: minification of checkout.js using execSync
const { execSync } = require('child_process');
try {
  execSync('npx terser checkout.js -c -m -o checkout.min.js');
  console.log('checkout.js re-minified.');
} catch(e) {
  console.log('Minify skipped ' + e.message);
}
