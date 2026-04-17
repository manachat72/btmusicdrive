const fs = require('fs');

let content = fs.readFileSync('components.js', 'utf8');

const cookieConsentLogic = `
function _initCookieConsent() {
  if (localStorage.getItem('btmusicdrive_cookie_consent')) return;
  
  const banner = document.createElement('div');
  banner.id = 'cookie-consent-banner';
  banner.className = 'fixed bottom-4 left-4 z-50 max-w-sm bg-white border border-gray-200 rounded-2xl shadow-2xl p-5 transform translate-y-10 opacity-0 transition-all duration-500';
  banner.innerHTML = \`
    <div class="flex items-start gap-4">
      <div class="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
        <i class="ph ph-cookie text-xl text-amber-600"></i>
      </div>
      <div>
        <h3 class="text-sm font-bold text-gray-900">เว็บไซต์นี้ใช้คุกกี้</h3>
        <p class="text-xs text-gray-500 mt-1 mb-3">เราใช้คุกกี้เพื่อมอบประสบการณ์การใช้งานที่ดีเยี่ยมบนเว็บไซต์ของเรา รวมถึงการวิเคราะห์และนำเสนอโปรโมชั่นที่ตรงใจคุณ</p>
        <div class="flex flex-wrap gap-2">
          <button id="accept-cookies" class="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors">ยอมรับทั้งหมด</button>
          <a href="/privacy" class="px-4 py-2 bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-100 transition-colors">รายละเอียด</a>
        </div>
      </div>
    </div>
  \`;
  document.body.appendChild(banner);
  
  requestAnimationFrame(() => {
    banner.classList.remove('translate-y-10', 'opacity-0');
    banner.classList.add('translate-y-0', 'opacity-100');
  });

  document.getElementById('accept-cookies').addEventListener('click', () => {
    localStorage.setItem('btmusicdrive_cookie_consent', 'accepted');
    banner.classList.remove('translate-y-0', 'opacity-100');
    banner.classList.add('translate-y-10', 'opacity-0');
    setTimeout(() => banner.remove(), 500);
  });
}
`;

// Insert the new function at the end
if (!content.includes('_initCookieConsent')) {
  // Add function definition
  content += `\n${cookieConsentLogic}\n`;
  
  // Call it inside DOMContentLoaded
  content = content.replace(/_updateWishlistBadge\(\);\n\}\);/, `_updateWishlistBadge();\n  _initCookieConsent();\n});`);
  
  fs.writeFileSync('components.js', content);
  console.log("Cookie consent added to components.js");
  
  // Minify
  const { execSync } = require('child_process');
  execSync('npx terser components.js -c -m -o components.min.js');
  console.log("Minified components.js");
} else {
  console.log("Already added");
}
