// ═══════════════════════════════════════════════════════════════════════════
// components.js — Shared page components for btmusicdrive
// Include on any sub-page that needs navbar, footer, cart, and auth.
// Usage: <script src="components.js"></script>  (at end of <body>)
// ═══════════════════════════════════════════════════════════════════════════

// ── Analytics + Marketing Pixels (PDPA-gated, load after consent=='all') ────
// Stub fbq so code that calls it before lib loads doesn't crash
window.fbq = window.fbq || function(){(window.fbq.queue = window.fbq.queue || []).push(arguments);};
let _marketingPixelsLoaded = false;
function _loadMarketingPixels() {
  if (_marketingPixelsLoaded) return;
  _marketingPixelsLoaded = true;

  // Google Tag Manager
  (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
    var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
    j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
    f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T3F9WD5P');

  // Google Analytics 4
  var gaScript = document.createElement('script');
  gaScript.async = true;
  gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-1QVJ5HDNZ5';
  document.head.appendChild(gaScript);
  gtag('js', new Date());
  gtag('config', 'G-1QVJ5HDNZ5');

  // Meta Pixel
  !function(f,b,e,v,n,t,s){if(f.fbq&&f.fbq.loaded)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=n.queue||[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
  (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('init','269855615506465');
  fbq('track','PageView');

  // TikTok Pixel
  !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};ttq.load('D7E0Q1RC77U88C4ADOSG');ttq.page()}(window,document,'ttq');
}
if (localStorage.getItem('btmusicdrive_cookie_consent') === 'all') {
  _loadMarketingPixels();
}

const API_BASE = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
  ? 'http://localhost:5000/api' : '/api';
const GOOGLE_CLIENT_ID = '46644504211-02mjffk321u1h5hbh1r5e5j5in30od93.apps.googleusercontent.com';

let _currentUser = null;
let _cart = [];
let _isLoginMode = true;
let _googleSdkPromise = null;
let _googleInitialized = false;

function _escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str ?? '')));
  return div.innerHTML;
}

// ── HTML Templates ──────────────────────────────────────────────────────────

function _navbarHTML() {
  return `
  <nav class="bg-secondary shadow-sm fixed w-full z-50 top-0 transition-all duration-300" id="navbar">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16 items-center">
        <a href="/" class="flex-shrink-0 flex items-center cursor-pointer no-underline">
          <img src="images/logo.webp" alt="btmusicdrive" class="h-9 w-9 rounded-full mr-2">
          <span class="font-bold text-xl tracking-tight text-white">btmusicdrive</span>
        </a>
        <div class="hidden md:flex flex-1 items-center justify-center gap-1 px-6" id="desktop-nav"></div>
        <div class="hidden md:flex items-center">
          <a href="/admin" id="admin-nav-link" class="hidden text-gray-300 hover:text-primary transition-colors font-medium flex items-center gap-1 text-sm mr-4">
            <i class="ph ph-shield-check text-base"></i> Admin
          </a>
        </div>
        <div class="flex items-center space-x-4">
          <button id="navbar-search-btn" class="text-gray-300 hover:text-primary transition-colors"><i class="ph ph-magnifying-glass text-2xl"></i></button>
          <button id="cart-btn" class="hidden md:block text-gray-300 hover:text-primary transition-colors relative" aria-label="ตะกร้าสินค้า">
            <i class="ph ph-shopping-cart text-2xl"></i>
            <span id="cart-count" class="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 items-center justify-center" style="display:none;">0</span>
          </button>
          <button class="hidden md:block text-gray-300 hover:text-primary transition-colors relative group" id="auth-btn">
            <i class="ph ph-user text-2xl"></i>
            <span id="user-greeting" class="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-white hidden whitespace-nowrap bg-gray-800 px-2 py-1 rounded shadow-sm"></span>
          </button>
        </div>
      </div>
    </div>
  </nav>
  <div id="search-overlay-backdrop" class="fixed inset-0 bg-black/60 z-[100] hidden"></div>
  <div id="navbar-search-bar" class="fixed top-0 left-0 right-0 z-[101] bg-secondary shadow-2xl transform -translate-y-full transition-transform duration-300 ease-in-out">
    <div class="max-w-3xl mx-auto px-4 py-5 flex items-center gap-3">
      <i class="ph ph-magnifying-glass text-2xl text-primary flex-shrink-0"></i>
      <input type="text" id="navbar-search-input" placeholder="ค้นหาสินค้า เช่น เพลงลูกทุ่ง, ป๊อปเกาหลี..." autocomplete="off" class="flex-1 bg-transparent text-white placeholder-gray-400 text-lg outline-none">
      <button id="navbar-search-close" class="text-gray-400 hover:text-white transition-colors p-1 flex-shrink-0"><i class="ph ph-x text-xl"></i></button>
    </div>
  </div>`;
}

function _cartSidebarHTML() {
  return `
  <div id="cart-sidebar" class="fixed top-0 right-0 bottom-[60px] md:bottom-0 max-w-sm w-full bg-white shadow-2xl z-[55] transform translate-x-full transition-transform duration-300 ease-in-out flex flex-col">
    <div class="flex items-center justify-between p-4 border-b border-gray-200">
      <h2 class="text-lg font-bold flex items-center"><i class="ph ph-shopping-cart mr-2"></i> ตะกร้าสินค้า</h2>
      <div class="flex items-center gap-3">
        <button id="clear-cart-btn" class="text-xs text-gray-400 hover:text-red-500 transition-colors hidden">ลบทั้งหมด</button>
        <button id="close-cart-btn" class="text-gray-500 hover:text-red-500 transition-colors"><i class="ph ph-x text-2xl"></i></button>
      </div>
    </div>
    <!-- Free Shipping Progress Bar -->
    <div id="free-shipping-bar" class="px-4 pt-3 pb-3 border-b border-amber-100" style="background:linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%)">
      <div class="flex items-center gap-2 mb-2">
        <span id="free-ship-icon" class="text-lg flex-shrink-0">🚚</span>
        <p id="free-shipping-msg" class="text-xs font-semibold text-amber-800 leading-tight flex-1">เพิ่มอีก <strong id="free-ship-remaining" class="text-amber-900">฿200</strong> เพื่อ <span class="text-orange-600">ส่งฟรี!</span></p>
        <span id="free-shipping-pct" class="text-xs font-bold text-amber-600 flex-shrink-0">0%</span>
      </div>
      <div class="relative w-full rounded-full h-3 overflow-hidden" style="background:rgba(251,191,36,0.25)">
        <div id="free-shipping-progress" class="h-full rounded-full transition-all duration-700 ease-out" style="width:0%;background:linear-gradient(90deg,#f59e0b,#ef4444)"></div>
        <div class="absolute inset-0 rounded-full pointer-events-none" style="background:linear-gradient(180deg,rgba(255,255,255,0.3) 0%,transparent 60%)"></div>
      </div>
    </div>
    <!-- Upsell: cheap products to reach free shipping -->
    <div id="free-ship-recs" class="hidden border-b border-amber-100" style="background:linear-gradient(135deg,#fffbeb,#fff7ed)">
      <div class="px-4 pt-2.5 pb-3">
        <p class="text-[11px] font-bold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <i class="ph ph-lightning text-amber-500"></i> เพิ่มสินค้าเพื่อรับส่งฟรี
        </p>
        <div id="free-ship-recs-list" class="flex gap-2.5 overflow-x-auto pb-1" style="scrollbar-width:none;-webkit-overflow-scrolling:touch"></div>
      </div>
    </div>
    <div id="cart-items-container" class="flex-1 overflow-y-auto p-4 space-y-4">
      <div class="text-center text-gray-500 mt-10" id="empty-cart-msg">
        <i class="ph ph-shopping-cart text-6xl mb-4 text-gray-300"></i>
        <p>ตะกร้าของคุณว่างเปล่า</p>
      </div>
    </div>
    <div class="border-t border-gray-200 bg-white">
      <!-- Price Breakdown -->
      <div class="px-4 pt-3 pb-3 space-y-1.5 text-sm">
        <div class="flex justify-between text-gray-500">
          <span>ราคาสินค้า</span>
          <span id="cart-subtotal-display">฿0.00</span>
        </div>
        <div class="flex justify-between text-gray-500">
          <span class="flex items-center gap-1.5"><i class="ph ph-truck text-xs text-primary"></i>ค่าจัดส่ง</span>
          <span id="cart-shipping-display" class="font-medium">฿35.00</span>
        </div>
        <div class="flex justify-between font-bold text-gray-900 text-base border-t border-dashed border-gray-200 pt-2 mt-1">
          <span>ยอดสุทธิ</span>
          <span id="cart-total">฿0.00</span>
        </div>
      </div>
      <!-- Checkout -->
      <div class="px-4 pb-4">
        <button onclick="window.location='/checkout'" class="w-full bg-primary hover:bg-amber-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-md flex items-center justify-center gap-2 text-base">
          <i class="ph ph-lock-key"></i> ดำเนินการชำระเงิน
        </button>
      </div>
    </div>
  </div>
  <div id="cart-overlay" class="fixed inset-0 bg-black bg-opacity-50 z-40 hidden transition-opacity"></div>`;
}

function _authModalHTML() {
  return `
  <div id="auth-modal" class="fixed inset-0 bg-black bg-opacity-50 z-[60] hidden items-center justify-center p-4 transition-opacity opacity-0">
    <div class="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl transform scale-95 transition-transform duration-300" id="auth-modal-content">
      <div class="flex justify-end items-center p-4">
        <button id="close-auth-btn" class="text-gray-400 hover:text-gray-600 transition-colors"><i class="ph ph-x text-2xl"></i></button>
      </div>
      <div class="px-8 pb-8">
        <h2 class="text-2xl font-bold text-gray-900 text-center mb-6" id="auth-title">\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A</h2>
        <div id="auth-error" class="hidden bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4 flex items-center">
          <i class="ph ph-warning-circle text-lg mr-2"></i><span id="auth-error-text"></span>
        </div>
        <form id="auth-form" class="space-y-4">
          <!-- honeypot: hidden from users, filled only by bots -->
          <div style="position:absolute;left:-9999px;top:-9999px;opacity:0;pointer-events:none;" aria-hidden="true">
            <input type="text" name="website" id="auth-hp" tabindex="-1" autocomplete="off">
          </div>
          <div class="relative">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><i class="ph ph-at text-xl"></i></span>
            <input type="email" id="auth-email" required class="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-colors text-gray-700" placeholder="\u0E2D\u0E35\u0E40\u0E21\u0E25">
          </div>
          <div class="relative">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><i class="ph ph-lock text-xl"></i></span>
            <input type="password" id="auth-password" required class="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-colors text-gray-700" placeholder="\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19">
            <button type="button" onclick="_togglePwVis()" class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <i class="ph ph-eye text-xl" id="pw-eye-icon"></i>
            </button>
          </div>
          <div id="auth-remember-row" class="flex items-center">
            <input type="checkbox" id="auth-remember" class="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary">
            <label for="auth-remember" class="ml-2 text-sm text-gray-600">\u0E08\u0E33\u0E09\u0E31\u0E19\u0E40\u0E02\u0E49\u0E32\u0E23\u0E30\u0E1A\u0E1A</label>
          </div>
          <button type="submit" id="auth-submit-btn" class="w-full bg-secondary hover:bg-slate-800 text-white font-bold py-3.5 px-4 rounded-xl transition-colors flex justify-center items-center text-lg">
            <span id="auth-submit-text">\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A</span>
            <i class="ph ph-spinner animate-spin hidden ml-2" id="auth-spinner"></i>
          </button>
        </form>
        <div class="mt-5">
          <div class="relative">
            <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-gray-200"></div></div>
            <div class="relative flex justify-center text-sm"><span class="px-3 bg-white text-gray-400">\u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E14\u0E49\u0E27\u0E22</span></div>
          </div>
          <div class="mt-5 space-y-3">
            <div id="google-btn-container" class="w-full">
              <div id="google-signin-button" class="w-full"></div>
            </div>
          </div>
        </div>
        <div class="mt-5 text-center">
          <p class="text-sm text-gray-600" id="auth-toggle-text">
            \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01?
            <button type="button" id="auth-toggle-btn" class="text-primary font-bold hover:underline">\u0E2A\u0E21\u0E31\u0E04\u0E23\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01</button>
          </p>
        </div>
        <div class="mt-4 text-center border-t border-gray-100 pt-4">
          <button type="button" class="text-sm font-bold text-gray-700 hover:text-primary transition-colors">\u0E25\u0E37\u0E21\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19 ?</button>
        </div>
      </div>
    </div>
  </div>`;
}

function _footerHTML() {
  // Social links — read from localStorage (set via admin > การตลาด), fallback to defaults
  const _fbUrl   = localStorage.getItem('btmd_social_facebook') || 'https://www.facebook.com/btmusicdrive';
  const _lineUrl = localStorage.getItem('btmd_social_line')     || 'https://line.me/R/ti/p/@bt1992?from=page&openQrModal=true&searchId=bt1992';
  const _ttUrl   = localStorage.getItem('btmd_social_tiktok')    || 'https://www.tiktok.com/@btmusicdrive';
  return `
  <footer class="bg-secondary pt-16 pb-8">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-12 mb-12">

        <!-- Logo + Description + Shop Links -->
<div>
  <div class="flex items-center mb-4 cursor-pointer" onclick="window.location='/'">
    <img src="images/logo.webp" alt="btmusicdrive" class="h-10 w-10 rounded-full mr-3">
    <span class="font-bold text-2xl tracking-tight text-white">btmusicdrive</span>
  </div>
  <p class="text-gray-400 mb-5 text-sm leading-relaxed">ร้านขายแฟลชไดร์ฟเพลง MP3 คุณภาพเสียง HD รวมเพลงฮิตทุกแนว เสียบปุ๊บฟังปั๊บ</p>
</div>

        <!-- บริการลูกค้า -->
        <div>
          <h4 class="font-bold text-white mb-5 text-base">บริการลูกค้า</h4>
          <ul class="space-y-3">
            <li><a href="/shipping" class="text-gray-400 hover:text-primary transition-colors text-sm">การจัดส่งสินค้า</a></li>
            <li><a href="/warranty" class="text-gray-400 hover:text-primary transition-colors text-sm">การรับประกันสินค้า</a></li>
            <li><a href="/returns" class="text-gray-400 hover:text-primary transition-colors text-sm">การคืนสินค้าและการคืนเงิน</a></li>
            <li><a href="/exchange" class="text-gray-400 hover:text-primary transition-colors text-sm">การยกเลิกการสั่งซื้อสินค้า</a></li>
            <li><a href="/track-order" class="text-gray-400 hover:text-primary transition-colors text-sm">เช็คสถานะการจัดส่ง</a></li>
          </ul>
        </div>

        <!-- เกี่ยวกับเรา -->
        <div>
          <h4 class="font-bold text-white mb-5 text-base">เกี่ยวกับเรา</h4>
          <ul class="space-y-3">
            <li><a href="/contact" class="text-gray-400 hover:text-primary transition-colors text-sm">ติดต่อเรา</a></li>
            <li><a href="/about" class="text-gray-400 hover:text-primary transition-colors text-sm">เกี่ยวกับเรา</a></li>
            <li><a href="/faq" class="text-gray-400 hover:text-primary transition-colors text-sm">คำถามที่พบบ่อย</a></li>
            <li><a href="/terms" class="text-gray-400 hover:text-primary transition-colors text-sm">ข้อกำหนดและเงื่อนไข</a></li>
            <li><a href="/privacy" class="text-gray-400 hover:text-primary transition-colors text-sm">นโยบายความเป็นส่วนตัว</a></li>
          </ul>
        </div>

        <!-- ติดต่อเรา -->
        <div>
          <h4 class="font-bold text-white mb-5 text-base">ติดต่อเรา</h4>
          <ul class="space-y-3 text-gray-400 text-sm">
            <li class="flex items-center gap-3"><i class="ph ph-envelope text-lg text-primary"></i><span>info@btmusicdrive.com</span></li>
          </ul>
          <div class="flex space-x-3 mt-5">
            <a href="${_fbUrl}" target="_blank" rel="noopener" title="Facebook"
               class="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg transition-all duration-200 hover:scale-110"
               style="background:linear-gradient(135deg,#1877f2,#0c5fd8);">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22 12c0-5.522-4.477-10-10-10S2 6.478 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987H7.898V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/>
              </svg>
            </a>
            <a href="${_lineUrl}" target="_blank" rel="noopener" title="Line"
               class="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg transition-all duration-200 hover:scale-110"
               style="background:linear-gradient(135deg,#06c755,#059d43);">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
              </svg>
            </a>
            ${_ttUrl ? `<a href="${_ttUrl}" target="_blank" rel="noopener" title="TikTok"
               class="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg transition-all duration-200 hover:scale-110"
               style="background:#111111;">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.19 8.19 0 004.79 1.54V6.78a4.85 4.85 0 01-1.02-.09z"/>
              </svg>
            </a>` : ''}
          </div>
        </div>

      </div>

      <!-- Bottom Bar -->
      <div class="border-t border-gray-700 pt-6 hidden md:flex flex-col md:flex-row justify-between items-center gap-4">
        <p class="text-gray-500 text-sm">&copy; 2026 btmusicdrive สงวนลิขสิทธิ์ทุกประการ</p>
        <div class="flex items-center gap-4 text-gray-500 text-xs">
          <a href="/terms" class="hover:text-white transition-colors">ข้อกำหนดและเงื่อนไข</a>
          <span>|</span>
          <a href="/privacy" class="hover:text-white transition-colors">นโยบายความเป็นส่วนตัว</a>
        </div>
      </div>
    </div>
  </footer>`;
}

function _mobileBottomNavHTML() {
  return `
  <style>
    ._dlink:active { background: rgba(255,255,255,0.07) !important; }
    @media (hover: hover) { ._dlink:hover { background: rgba(255,255,255,0.04) !important; } }
    #bnav-home.active-tab, #bnav-home.active-tab i,
    .bnav-tab.active-tab, .bnav-tab.active-tab i { color: #8B7355 !important; }
    #bnav-account-btn {
      color: #64748b;
      outline: none !important;
      box-shadow: none !important;
      -webkit-tap-highlight-color: transparent;
      appearance: none;
    }
    #bnav-account-btn i { color: currentColor !important; font-size: 21px !important; line-height: 1; }
    #bnav-account-btn span.bnav-account-label { font-size: 9px; letter-spacing: 0.04em; font-weight: 500; }
    #bnav-account-btn:focus,
    #bnav-account-btn:focus-visible,
    #bnav-account-btn:active {
      outline: none !important;
      box-shadow: none !important;
      border: 0 !important;
    }
    #bnav-account-btn:hover { color: #8B7355; }
  </style>

  <!-- ── Mobile Bottom Bar ── -->
  <nav id="mobile-bottom-nav" class="fixed bottom-0 left-0 right-0 z-50 md:hidden" style="background:#0F172A;border-top:1px solid rgba(139,115,85,0.18);height:60px;">
    <div class="flex h-full">
      <a href="/" id="bnav-home" class="flex flex-col items-center justify-center flex-1 gap-[3px] no-underline" style="color:#64748b;">
        <i class="ph ph-house" style="font-size:21px;line-height:1;"></i>
        <span style="font-size:9px;letter-spacing:0.04em;font-weight:500;">หน้าแรก</span>
      </a>
      <a href="/shop" class="flex flex-col items-center justify-center flex-1 gap-[3px] no-underline" style="color:#64748b;">
        <i class="ph ph-storefront" style="font-size:21px;line-height:1;"></i>
        <span style="font-size:9px;letter-spacing:0.04em;font-weight:500;">ร้านค้า</span>
      </a>
      <a href="/cart" id="bnav-cart-btn" class="flex flex-col items-center justify-center flex-1 gap-[3px] relative no-underline" style="color:#64748b;">
        <div class="relative flex-shrink-0" style="width:28px;height:24px;display:flex;align-items:center;justify-content:center;">
          <i class="ph ph-shopping-cart" style="font-size:21px;line-height:1;"></i>
          <span id="bnav-cart-count" class="absolute flex items-center justify-center" style="top:-2px;right:-4px;min-width:14px;height:14px;padding:0 3px;font-size:7.5px;font-weight:700;color:#fff;background:#8B7355;border-radius:99px;display:none;">0</span>
        </div>
      </a>
      <button id="bnav-account-btn" class="flex flex-col items-center justify-center flex-1 gap-[3px]" style="background:none;border:none;cursor:pointer;">
        <i class="ph ph-user"></i>
        <span class="bnav-account-label">บัญชี</span>
      </button>
    </div>
  </nav>

  <!-- Backdrop -->
  <div id="bnav-account-overlay" class="fixed inset-0 z-[55] hidden md:hidden" style="background:rgba(0,0,0,0.72);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);"></div>

  <!-- ── Side Drawer (right, dark minimalist) ── -->
  <div id="bnav-account-menu" class="fixed inset-y-0 right-0 z-[56] transform translate-x-full transition-transform duration-300 ease-in-out md:hidden flex flex-col" style="width:82%;max-width:300px;background:#0A1120;box-shadow:-12px 0 48px rgba(0,0,0,0.7);">

    <!-- Profile Header -->
    <div style="position:relative;padding:52px 22px 20px;background:linear-gradient(165deg,#13213a 0%,#0A1120 65%);border-bottom:1px solid rgba(139,115,85,0.12);">
      <button id="bnav-drawer-close" style="position:absolute;top:12px;right:14px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.07);cursor:pointer;">
        <i class="ph ph-x" style="font-size:15px;color:#94a3b8;"></i>
      </button>

      <div style="display:flex;align-items:center;gap:14px;">
        <div id="bnav-avatar" style="width:50px;height:50px;border-radius:50%;background:rgba(139,115,85,0.12);border:1.5px solid rgba(139,115,85,0.3);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">
          <i class="ph ph-user" style="font-size:24px;color:#8B7355;"></i>
        </div>
        <div style="flex:1;min-width:0;">
          <p id="bnav-user-name" style="margin:0;font-weight:600;font-size:14px;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">ยังไม่ได้เข้าสู่ระบบ</p>
          <p id="bnav-user-email" style="margin:3px 0 0;font-size:11px;color:#475569;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></p>
        </div>
      </div>

      <!-- Stats (JS toggles display) -->
      <div id="bnav-stats" class="flex" style="display:none;gap:8px;margin-top:16px;">
        <div style="flex:1;background:rgba(139,115,85,0.1);border:1px solid rgba(139,115,85,0.14);border-radius:10px;padding:8px 4px;text-align:center;">
          <p id="bnav-order-count" style="margin:0;font-weight:700;font-size:16px;color:#8B7355;">0</p>
          <p style="margin:2px 0 0;font-size:9px;color:#64748b;">คำสั่งซื้อ</p>
        </div>
        <div style="flex:1;background:rgba(139,115,85,0.1);border:1px solid rgba(139,115,85,0.14);border-radius:10px;padding:8px 4px;text-align:center;">
          <p id="bnav-wishlist-count" style="margin:0;font-weight:700;font-size:16px;color:#8B7355;">0</p>
          <p style="margin:2px 0 0;font-size:9px;color:#64748b;">ถูกใจ</p>
        </div>
        <div style="flex:1;background:rgba(139,115,85,0.1);border:1px solid rgba(139,115,85,0.14);border-radius:10px;padding:8px 4px;text-align:center;">
          <p id="bnav-review-count" style="margin:0;font-weight:700;font-size:16px;color:#8B7355;">0</p>
          <p style="margin:2px 0 0;font-size:9px;color:#64748b;">รีวิว</p>
        </div>
      </div>
    </div>

    <!-- Menu Body -->
    <div style="flex:1;overflow-y:auto;padding:4px 0;">

      <p style="margin:0;padding:14px 20px 6px;font-size:9px;font-weight:600;letter-spacing:0.13em;text-transform:uppercase;color:rgba(139,115,85,0.5);">เมนูหลัก</p>

      <a href="/" class="_dlink" style="display:flex;align-items:center;gap:13px;padding:11px 20px;text-decoration:none;transition:background 0.15s;">
        <span style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:rgba(139,115,85,0.1);flex-shrink:0;"><i class="ph ph-house" style="font-size:17px;color:#8B7355;"></i></span>
        <span style="font-size:13.5px;font-weight:500;color:#cbd5e1;">หน้าแรก</span>
      </a>
      <a href="/shop" class="_dlink" style="display:flex;align-items:center;gap:13px;padding:11px 20px;text-decoration:none;transition:background 0.15s;">
        <span style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:rgba(139,115,85,0.1);flex-shrink:0;"><i class="ph ph-storefront" style="font-size:17px;color:#8B7355;"></i></span>
        <span style="font-size:13.5px;font-weight:500;color:#cbd5e1;">ร้านค้า</span>
      </a>
      <a href="/track-order" class="_dlink" style="display:flex;align-items:center;gap:13px;padding:11px 20px;text-decoration:none;transition:background 0.15s;">
        <span style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:rgba(139,115,85,0.1);flex-shrink:0;"><i class="ph ph-truck" style="font-size:17px;color:#8B7355;"></i></span>
        <span style="font-size:13.5px;font-weight:500;color:#cbd5e1;">ติดตามพัสดุ</span>
      </a>
      <div style="height:1px;background:rgba(255,255,255,0.05);margin:6px 20px;"></div>

      <p style="margin:0;padding:10px 20px 6px;font-size:9px;font-weight:600;letter-spacing:0.13em;text-transform:uppercase;color:rgba(139,115,85,0.5);">บัญชี</p>

      <a href="/orders" class="_dlink" style="display:flex;align-items:center;gap:13px;padding:11px 20px;text-decoration:none;transition:background 0.15s;">
        <span style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:rgba(139,115,85,0.1);flex-shrink:0;"><i class="ph ph-package" style="font-size:17px;color:#8B7355;"></i></span>
        <span style="font-size:13.5px;font-weight:500;color:#cbd5e1;">คำสั่งซื้อ</span>
      </a>
      <a href="/profile" class="_dlink" style="display:flex;align-items:center;gap:13px;padding:11px 20px;text-decoration:none;transition:background 0.15s;">
        <span style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:rgba(139,115,85,0.1);flex-shrink:0;"><i class="ph ph-user-circle" style="font-size:17px;color:#8B7355;"></i></span>
        <span style="font-size:13.5px;font-weight:500;color:#cbd5e1;">ข้อมูลส่วนตัว</span>
      </a>
      <a href="/address" class="_dlink" style="display:flex;align-items:center;gap:13px;padding:11px 20px;text-decoration:none;transition:background 0.15s;">
        <span style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:rgba(139,115,85,0.1);flex-shrink:0;"><i class="ph ph-map-pin" style="font-size:17px;color:#8B7355;"></i></span>
        <span style="font-size:13.5px;font-weight:500;color:#cbd5e1;">ที่อยู่จัดส่ง</span>
      </a>

      <div style="height:1px;background:rgba(255,255,255,0.05);margin:6px 20px;"></div>

      <p style="margin:0;padding:10px 20px 6px;font-size:9px;font-weight:600;letter-spacing:0.13em;text-transform:uppercase;color:rgba(139,115,85,0.5);">ช่วยเหลือ</p>

      <a href="/contact" class="_dlink" style="display:flex;align-items:center;gap:13px;padding:11px 20px;text-decoration:none;transition:background 0.15s;">
        <span style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:rgba(139,115,85,0.1);flex-shrink:0;"><i class="ph ph-chat-circle-dots" style="font-size:17px;color:#8B7355;"></i></span>
        <span style="font-size:13.5px;font-weight:500;color:#cbd5e1;">ติดต่อเรา</span>
      </a>
      <a href="/about" class="_dlink" style="display:flex;align-items:center;gap:13px;padding:11px 20px;text-decoration:none;transition:background 0.15s;">
        <span style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:rgba(139,115,85,0.1);flex-shrink:0;"><i class="ph ph-info" style="font-size:17px;color:#8B7355;"></i></span>
        <span style="font-size:13.5px;font-weight:500;color:#cbd5e1;">เกี่ยวกับเรา</span>
      </a>
    </div>

    <!-- Footer: Logout / Login -->
    <div style="padding:12px 14px 20px;border-top:1px solid rgba(255,255,255,0.06);">
      <a href="#" id="bnav-logout-btn" class="flex" style="align-items:center;justify-content:center;gap:8px;padding:11px;border-radius:12px;font-size:13px;font-weight:600;color:#f87171;background:rgba(248,113,113,0.07);text-decoration:none;border:1px solid rgba(248,113,113,0.1);">
        <i class="ph ph-sign-out" style="font-size:16px;"></i> ออกจากระบบ
      </a>
      <a href="#" id="bnav-login-btn" class="flex" style="align-items:center;justify-content:center;gap:8px;padding:11px;border-radius:12px;font-size:13px;font-weight:600;color:#fff;background:#8B7355;text-decoration:none;border:1px solid rgba(139,115,85,0.3);">
        <i class="ph ph-sign-in" style="font-size:16px;"></i> เข้าสู่ระบบ
      </a>
    </div>
  </div>`;
}




// ── Inject into page ────────────────────────────────────────────────────────
(function injectComponents() {
  const h = document.getElementById('site-header');
  if (h) h.innerHTML = _navbarHTML();

  const f = document.getElementById('site-footer');
  if (f) f.innerHTML = _footerHTML();

  // Populate footer categories dynamically
  const footerCats = document.getElementById('footer-categories');
  if (footerCats) {
    try {
      const cats = JSON.parse(localStorage.getItem('btmusicdrive_categories') || '[]')
        .filter(c => c.isActive !== false);
      if (cats.length > 0) {
        cats.forEach(c => {
          const li = document.createElement('li');
          const catUrl = c.slug ? `/category/${c.slug}` : `/category?cat=${encodeURIComponent(c.name)}`;
          li.innerHTML = `<a href="${catUrl}" class="text-gray-500 hover:text-primary transition-colors">${c.name}</a>`;
          footerCats.appendChild(li);
        });
      }
    } catch {}
  }

  if (!document.getElementById('cart-sidebar')) {
    document.body.insertAdjacentHTML('beforeend', _cartSidebarHTML());
  }
  if (!document.getElementById('auth-modal')) {
    document.body.insertAdjacentHTML('beforeend', _authModalHTML());
  }

  // Mobile Bottom Navigation Bar
  if (!document.getElementById('mobile-bottom-nav')) {
    document.body.insertAdjacentHTML('beforeend', _mobileBottomNavHTML());
  }


  // Fix: iOS Safari breaks position:fixed when body has overflow-x:hidden
  // Move overflow-x:hidden to html element instead
  if (document.body.classList.contains('overflow-x-hidden')) {
    document.body.classList.remove('overflow-x-hidden');
    document.documentElement.style.overflowX = 'hidden';
  }

  // ── Vercel Web Analytics ────────────────────────────────────────────────────
  if (!document.getElementById('vercel-analytics')) {
    const va = document.createElement('script');
    va.id = 'vercel-analytics';
    va.defer = true;
    va.src = '/_vercel/insights/script.js';
    document.head.appendChild(va);
  }
})();

// ── Dynamic Navigation Menus ────────────────────────────────────────────────
const _DEFAULT_MENUS = [
  { label: 'หน้าแรก', url: '/', icon: 'ph ph-house' },
  { label: 'ร้านค้า', url: '/shop', icon: 'ph ph-storefront' },
  { label: 'หมวดหมู่', url: '#', icon: 'ph ph-squares-four', children: [
    { label: 'สินค้าทั้งหมด', url: '/shop', icon: 'ph ph-package' },
    { label: 'เพื่อชีวิต', url: '/category/phuea-chiwit', icon: 'ph ph-microphone-stage' },
    { label: 'เพลงสตริง', url: '/category/phleng-satring', icon: 'ph ph-music-notes' },
    { label: 'ลูกทุ่ง', url: '/category/lukthung', icon: 'ph ph-vinyl-record' },
    { label: 'เพลงสากล', url: '/category/international', icon: 'ph ph-globe' },
    { label: 'ลูกกรุง', url: '/category/luk-krung', icon: 'ph ph-music-note' },
  ]},
  { label: 'เกี่ยวกับ', url: '/about', icon: 'ph ph-info' },
  { label: 'ติดตามพัสดุ', url: '/track-order', icon: 'ph ph-package' },
];

async function _loadNavMenus() {
  let menus = _DEFAULT_MENUS;
  try {
    const res = await fetch(`${API_BASE}/menus`);
    if (res.ok) { const data = await res.json(); if (data.length > 0) menus = data; }
  } catch {
    // Fallback: try localStorage menus from admin
    try {
      const ls = JSON.parse(localStorage.getItem('btmusicdrive_menus') || '[]');
      const active = ls.filter(m => m.isActive !== false && !m.parentId);
      active.forEach(m => { if (m.children) m.children = m.children.filter(c => c.isActive !== false); });
      if (active.length > 0) menus = active;
    } catch { /* use defaults */ }
  }
  _renderNavMenus(menus);
}

function _renderNavMenus(menus) {
  const desktop = document.getElementById('desktop-nav');
  const mobile = document.getElementById('mobile-nav');
  if (!desktop) return;

  desktop.innerHTML = menus.map(m => {
    const icon = m.icon ? `<i class="${m.icon} text-base"></i> ` : '';
    if (m.children && m.children.length > 0) {
      const sub = m.children.map(c =>
        `<a href="${c.url}" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary">${c.icon ? `<i class="${c.icon}"></i> ` : ''}${c.label}</a>`
      ).join('');
      return `<div class="relative group">
        <button class="text-gray-300 hover:text-primary transition-colors font-medium flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-white/10">${icon}${m.label} <i class="ph ph-caret-down text-xs ml-1"></i></button>
        <div class="absolute left-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">${sub}</div>
      </div>`;
    }
    return `<a href="${m.url}" class="text-gray-300 hover:text-primary transition-colors font-medium flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-white/10">${icon}${m.label}</a>`;
  }).join('');

  if (mobile) {
    mobile.innerHTML = menus.map((m, i) => {
      const icon = m.icon ? `<i class="${m.icon}"></i>` : '';
      if (m.children && m.children.length > 0) {
        const subItems = m.children.map(c =>
          `<a href="${c.url}" class="block pl-7 pr-3 py-[6px] text-xs text-gray-400 hover:text-primary hover:bg-white/10 rounded-md flex items-center gap-2">${c.icon ? `<i class="${c.icon}"></i>` : ''}${c.label}</a>`
        ).join('');
        return `<div class="mob-has-sub">
          <button type="button" class="mob-sub-toggle w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-primary hover:bg-white/10" data-sub="${i}" aria-expanded="false">
            ${icon}<span class="flex-1 text-left">${m.label}</span>
            <i class="mob-caret" style="font-size:10px;transition:transform .2s;">▾</i>
          </button>
          <div class="mob-sub-panel" data-sub="${i}" style="display:none;">${subItems}</div>
        </div>`;
      }
      return `<a href="${m.url}" class="block px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-primary hover:bg-white/10 flex items-center gap-2">${icon}${m.label}</a>`;
    }).join('') + `<a href="/admin" id="admin-nav-link-mobile" class="hidden px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-primary hover:bg-white/10 flex items-center gap-2"><i class="ph ph-shield-check"></i> Admin Dashboard</a>`;

    // Event delegation ผ่าน parent ที่ไม่ถูก re-render
    if (!mobile._subMenuBound) {
      mobile._subMenuBound = true;
      mobile.addEventListener('click', function(e) {
        const btn = e.target.closest('.mob-sub-toggle');
        if (btn) {
          const key = btn.dataset.sub;
          const panel = mobile.querySelector(`.mob-sub-panel[data-sub="${key}"]`);
          const caret = btn.querySelector('.mob-caret');
          if (!panel) return;
          const open = panel.style.display !== 'none';
          panel.style.display = open ? 'none' : 'block';
          btn.setAttribute('aria-expanded', String(!open));
          if (caret) caret.style.transform = open ? '' : 'rotate(180deg)';
          return;
        }

        const navLink = e.target.closest('a[href]');
        if (!navLink || !mobile.contains(navLink)) return;

        closeMobileMenu(mobile);
      });
    }
  }
}

function closeMobileMenu(mobile) {
  document.getElementById('mobile-menu')?.classList.add('hidden');
  mobile.querySelectorAll('.mob-sub-panel').forEach(panel => { panel.style.display = 'none'; });
  mobile.querySelectorAll('.mob-sub-toggle').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
  mobile.querySelectorAll('.mob-caret').forEach(caret => { caret.style.transform = ''; });
}

// ── Auth ─────────────────────────────────────────────────────────────────────

function _togglePwVis() {
  const pw = document.getElementById('auth-password');
  const icon = document.getElementById('pw-eye-icon');
  if (!pw) return;
  if (pw.type === 'password') { pw.type = 'text'; icon.className = 'ph ph-eye-slash text-xl'; }
  else { pw.type = 'password'; icon.className = 'ph ph-eye text-xl'; }
}
window._togglePwVis = _togglePwVis;

function _toggleAuthModal() {
  const m = document.getElementById('auth-modal');
  const c = document.getElementById('auth-modal-content');
  if (!m) return;
  const isHidden = m.classList.contains('hidden');
  if (isHidden) {
    m.classList.remove('hidden'); m.classList.add('flex');
    setTimeout(() => { m.classList.remove('opacity-0'); c.classList.remove('scale-95'); c.classList.add('scale-100'); }, 10);
    setTimeout(() => { _initGoogleSignIn(); }, 120);
    document.body.style.overflow = 'hidden';
  } else {
    m.classList.add('opacity-0'); c.classList.remove('scale-100'); c.classList.add('scale-95');
    setTimeout(() => { m.classList.add('hidden'); m.classList.remove('flex'); document.body.style.overflow = ''; document.getElementById('auth-form')?.reset(); document.getElementById('auth-error')?.classList.add('hidden'); }, 300);
  }
}

function _updateAuthUI() {
  const t = document.getElementById('auth-title');
  const s = document.getElementById('auth-submit-text');
  const b = document.getElementById('auth-toggle-btn');
  const r = document.getElementById('auth-remember-row');
  const txt = document.getElementById('auth-toggle-text');
  if (t) t.textContent = _isLoginMode ? '\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A' : '\u0E2A\u0E21\u0E31\u0E04\u0E23\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01';
  if (s) s.textContent = _isLoginMode ? '\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A' : '\u0E2A\u0E21\u0E31\u0E04\u0E23\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01';
  if (b) b.textContent = _isLoginMode ? '\u0E2A\u0E21\u0E31\u0E04\u0E23\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01' : '\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A';
  if (r) r.style.display = _isLoginMode ? 'flex' : 'none';
  if (txt) txt.childNodes[0].nodeValue = _isLoginMode ? '\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01? ' : '\u0E21\u0E35\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E41\u0E25\u0E49\u0E27? ';
  document.getElementById('auth-error')?.classList.add('hidden');
}

function _setAuthLoading(loading) {
  const st = document.getElementById('auth-submit-text');
  const sp = document.getElementById('auth-spinner');
  const btn = document.getElementById('auth-submit-btn');
  if (loading) { st?.classList.add('opacity-0'); sp?.classList.remove('hidden'); if (btn) btn.disabled = true; }
  else { st?.classList.remove('opacity-0'); sp?.classList.add('hidden'); if (btn) btn.disabled = false; }
}

function _showAuthError(msg) {
  const e = document.getElementById('auth-error');
  const t = document.getElementById('auth-error-text');
  if (e && t) { t.textContent = msg; e.classList.remove('hidden'); }
}

async function _handleAuthSubmit(e) {
  e.preventDefault();
  if (document.getElementById('auth-hp')?.value) return;
  const email = document.getElementById('auth-email')?.value;
  const password = document.getElementById('auth-password')?.value;
  _setAuthLoading(true);
  document.getElementById('auth-error')?.classList.add('hidden');
  try {
    const endpoint = _isLoginMode ? '/auth/login' : '/auth/register';
    const res = await fetch(`${API_BASE}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Authentication failed');
    localStorage.setItem('btmusicdrive_token', data.token);
    _currentUser = data.user;
    _updateUserUI();
    _toggleAuthModal();
    _showToast(_isLoginMode ? '\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08!' : '\u0E2A\u0E21\u0E31\u0E04\u0E23\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08!');
  } catch (err) { _showAuthError(err.message); }
  finally { _setAuthLoading(false); }
}

async function _handleGoogleCredential(response) {
  _setAuthLoading(true);
  document.getElementById('auth-error')?.classList.add('hidden');
  try {
    const res = await fetch(`${API_BASE}/auth/google`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: response.credential }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Google login failed');
    localStorage.setItem('btmusicdrive_token', data.token);
    _currentUser = data.user;
    _updateUserUI(); _toggleAuthModal();
    _showToast('\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E14\u0E49\u0E27\u0E22 Google \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08!');
  } catch (err) { _showAuthError(err.message); }
  finally { _setAuthLoading(false); }
}
window._handleGoogleCredential = _handleGoogleCredential;

function _loadGoogleSDK() {
  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google);
  }

  if (_googleSdkPromise) {
    return _googleSdkPromise;
  }

  _googleSdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');

    const handleLoad = () => {
      if (window.google?.accounts?.id) resolve(window.google);
      else reject(new Error('Google SDK loaded but API is unavailable'));
    };

    const handleError = () => reject(new Error('Failed to load Google SDK'));

    if (existing) {
      existing.addEventListener('load', handleLoad, { once: true });
      existing.addEventListener('error', handleError, { once: true });

      setTimeout(() => {
        if (window.google?.accounts?.id) resolve(window.google);
      }, 200);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
    document.head.appendChild(script);
  });

  return _googleSdkPromise;
}

async function _initGoogleSignIn() {
  const mount = document.getElementById('google-signin-button');
  if (!mount) return;

  mount.innerHTML = '<div class="w-full border border-gray-200 rounded-xl py-3 text-sm text-gray-400 text-center">กำลังโหลด Google...</div>';

  try {
    await _loadGoogleSDK();

    if (!_googleInitialized) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: _handleGoogleCredential,
      });
      _googleInitialized = true;
    }

    mount.innerHTML = '';
    const width = Math.max(280, Math.min(mount.parentElement?.clientWidth || 320, 360));
    window.google.accounts.id.renderButton(mount, {
      type: 'standard',
      shape: 'rectangular',
      theme: 'outline',
      text: 'signin_with',
      size: 'large',
      logo_alignment: 'center',
      width,
      locale: 'th',
    });
  } catch (err) {
    mount.innerHTML = '<div class="w-full border border-gray-200 rounded-xl py-3 text-sm text-gray-400 text-center">Google login ไม่พร้อมใช้งาน</div>';
  }
}

async function _checkAuthState() {
  const token = localStorage.getItem('btmusicdrive_token');
  if (!token) return;
  try {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) { const data = await res.json(); _currentUser = data.user; _updateUserUI(); }
    else localStorage.removeItem('btmusicdrive_token');
  } catch {}
}

function _handleLogout() {
  if (confirm('\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E23\u0E30\u0E1A\u0E1A\u0E2B\u0E23\u0E37\u0E2D?')) {
    localStorage.removeItem('btmusicdrive_token');
    _currentUser = null;
    _updateUserUI();
    _showToast('\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E23\u0E30\u0E1A\u0E1A\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08');
  }
}

function _updateUserUI() {
  const btn = document.getElementById('auth-btn');
  const icon = btn?.querySelector('i');
  const greeting = document.getElementById('user-greeting');
  const adminLink = document.getElementById('admin-nav-link');
  const adminMobile = document.getElementById('admin-nav-link-mobile');

  if (_currentUser) {
    icon?.classList.remove('ph-user');
    icon?.classList.add('ph-fill', 'ph-user-circle', 'text-primary');
    if (greeting) { greeting.textContent = `Hi, ${_currentUser.email.split('@')[0]}`; greeting.classList.remove('hidden'); }
    const isAdmin = _currentUser.role === 'ADMIN';
    adminLink?.classList.toggle('hidden', !isAdmin);
    adminMobile?.classList.toggle('hidden', !isAdmin);
  } else {
    icon?.classList.remove('ph-fill', 'ph-user-circle', 'text-primary');
    icon?.classList.add('ph-user');
    greeting?.classList.add('hidden');
    adminLink?.classList.add('hidden');
    adminMobile?.classList.add('hidden');
  }
  _updateBnavAccountState();
}

function _updateBnavAccountState() {
  const nameEl = document.getElementById('bnav-user-name');
  const emailEl = document.getElementById('bnav-user-email');
  const logoutBtn = document.getElementById('bnav-logout-btn');
  const loginBtn = document.getElementById('bnav-login-btn');
  const avatarEl = document.getElementById('bnav-avatar');
  const statsEl = document.getElementById('bnav-stats');
  if (!nameEl) return;
  const user = _currentUser || JSON.parse(localStorage.getItem('user') || 'null');
  if (user) {
    const displayName = (user.firstName || user.name || user.email?.split('@')[0] || '') + (user.lastName ? ' ' + user.lastName : '');
    nameEl.textContent = displayName;
    if (emailEl) emailEl.textContent = user.email || '';
    if (avatarEl && user.avatar) {
      avatarEl.innerHTML = `<img src="${_escapeHtml(user.avatar)}" class="w-full h-full object-cover rounded-full" alt="">`;
    }
    if (statsEl) statsEl.style.display = '';
    if (logoutBtn) logoutBtn.style.display = '';
    if (loginBtn) loginBtn.style.display = 'none';
  } else {
    nameEl.textContent = 'ยังไม่ได้เข้าสู่ระบบ';
    if (emailEl) emailEl.textContent = '';
    if (statsEl) statsEl.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (loginBtn) loginBtn.style.display = '';
  }
}

function _toggleAccountDrawer(forceOpen) {
  const drawer = document.getElementById('bnav-account-menu');
  const overlay = document.getElementById('bnav-account-overlay');
  if (!drawer) return;
  const isOpen = !drawer.classList.contains('translate-x-full');
  const shouldOpen = forceOpen !== undefined ? forceOpen : !isOpen;
  if (shouldOpen) {
    _updateBnavAccountState();
    overlay?.classList.remove('hidden');
    drawer.classList.remove('translate-x-full');
    document.body.style.overflow = 'hidden';
  } else {
    drawer.classList.add('translate-x-full');
    overlay?.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

// ── Cart ─────────────────────────────────────────────────────────────────────

function _toggleCart() {
  const sidebar = document.getElementById('cart-sidebar');
  const overlay = document.getElementById('cart-overlay');
  if (!sidebar) return;
  const open = !sidebar.classList.contains('translate-x-full');
  if (open) { sidebar.classList.add('translate-x-full'); overlay?.classList.add('hidden'); document.body.style.overflow = ''; }
  else { sidebar.classList.remove('translate-x-full'); overlay?.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
}

function _updateCartUI() {
  const countEl = document.getElementById('cart-count');
  const totalEl = document.getElementById('cart-total');
  const container = document.getElementById('cart-items-container');
  const emptyMsg = document.getElementById('empty-cart-msg');

  const totalItems = _cart.reduce((s, i) => s + i.quantity, 0);
  if (countEl) {
    countEl.textContent = totalItems;
    countEl.style.display = totalItems > 0 ? 'flex' : 'none';
  }

  // Update bottom nav cart count badge
  const bnavCount = document.getElementById('bnav-cart-count');
  if (bnavCount) {
    bnavCount.textContent = totalItems;
    bnavCount.style.display = totalItems > 0 ? 'flex' : 'none';
  }

  const clearBtn = document.getElementById('clear-cart-btn');

  const _cartSubtotal = _cart.reduce((s, i) => s + i.price * i.quantity, 0);
  _updateFreeShippingBar(_cartSubtotal);
  _updateBnavCart(_cartSubtotal);

  if (_cart.length === 0) {
    if (emptyMsg) emptyMsg.style.display = 'block';
    if (container) { container.innerHTML = ''; container.appendChild(emptyMsg); }
    _updateCartPriceBreakdown(0, 0, 0);

    if (clearBtn) clearBtn.classList.add('hidden');
    return;
  }
  if (emptyMsg) emptyMsg.style.display = 'none';
  if (clearBtn) clearBtn.classList.remove('hidden');
  if (!container) return;

  let total = 0;
  container.innerHTML = '';
  _cart.forEach(item => {
    const sub = item.price * item.quantity;
    total += sub;
    const el = document.createElement('div');
    el.className = 'flex gap-4 py-4 border-b border-gray-100';
    el.innerHTML = `
      <div class="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
        <img src="${item.image}" alt="${item.name}" class="w-full h-full object-cover">
      </div>
      <div class="flex-1 flex flex-col">
        <div class="flex justify-between">
          <h4 class="text-sm font-bold text-gray-900 line-clamp-2 pr-2">${item.name}</h4>
          <button class="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center -mt-2 -mr-2" onclick="_removeFromCart('${item.id}')"><i class="ph ph-trash text-base"></i></button>
        </div>
        <div class="flex justify-between items-center mt-auto pt-1">
          <div class="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button class="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-primary hover:bg-gray-50 transition-colors" onclick="_updateQty('${item.id}',-1)"><i class="ph ph-minus text-sm"></i></button>
            <span class="px-3 text-sm font-bold text-gray-900 min-w-[32px] text-center">${item.quantity}</span>
            <button class="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-primary hover:bg-gray-50 transition-colors" onclick="_updateQty('${item.id}',1)"><i class="ph ph-plus text-sm"></i></button>
          </div>
          <span class="font-bold text-gray-900">\u0E3F${sub.toFixed(2)}</span>
        </div>
      </div>`;
    container.appendChild(el);
  });

  // Calculate shipping
  const shippingThreshold = Number(localStorage.getItem('btmd_free_shipping_threshold') || 200);
  const shippingCost = Number(localStorage.getItem('btmd_shipping_cost') || 35);
  const shipping = total >= shippingThreshold ? 0 : shippingCost;
  const grandTotal = total + shipping;

  _updateCartPriceBreakdown(total, shipping, grandTotal);
}

function _updateCartPriceBreakdown(subtotal, shipping, grandTotal) {
  const totalEl = document.getElementById('cart-total');
  const subtotalEl = document.getElementById('cart-subtotal-display');
  const shippingEl = document.getElementById('cart-shipping-display');

  if (subtotalEl) subtotalEl.textContent = `\u0E3F${subtotal.toFixed(2)}`;
  if (shippingEl) {
    if (shipping === 0) {
      shippingEl.textContent = 'ฟรี';
      shippingEl.className = 'font-semibold text-green-600';
    } else {
      shippingEl.textContent = `\u0E3F${shipping.toFixed(2)}`;
      shippingEl.className = 'font-medium text-gray-500';
    }
  }
  if (totalEl) totalEl.textContent = `\u0E3F${(grandTotal ?? subtotal).toFixed(2)}`;
}

function _updateBnavCart(subtotal) {
  const threshold = Number(localStorage.getItem('btmd_free_shipping_threshold') || 200);
  const amountEl = document.getElementById('bnav-cart-amount');
  const labelEl  = document.getElementById('bnav-cart-label');
  const stripFill = document.getElementById('bnav-ship-strip-fill');
  const pct = Math.min((subtotal / threshold) * 100, 100);

  if (stripFill) stripFill.style.width = pct + '%';
  if (stripFill) stripFill.style.background = pct >= 100
    ? '#16a34a'
    : `linear-gradient(90deg,#f59e0b,#ef4444)`;

  if (amountEl) amountEl.style.display = 'none';
  if (labelEl) labelEl.style.display = 'none';
}

let _freeShipRecsCache = null;
let _freeShipRecsLastCartKey = '';

async function _loadFreeShipRecs() {
  if (_freeShipRecsCache) return _freeShipRecsCache;
  try {
    const res = await fetch(`${API_BASE}/products?limit=8`);
    if (res.ok) {
      const json = await res.json();
      _freeShipRecsCache = (json.data || json).slice(0, 6);
    }
  } catch (_) {}
  if (!_freeShipRecsCache) {
    try {
      const res = await fetch('/products.json');
      if (res.ok) _freeShipRecsCache = (await res.json()).slice(0, 6);
    } catch (_) {}
  }
  return _freeShipRecsCache || [];
}

async function _renderFreeShipRecs(total) {
  const threshold = Number(localStorage.getItem('btmd_free_shipping_threshold') || 200);
  const sec = document.getElementById('free-ship-recs');
  const list = document.getElementById('free-ship-recs-list');
  if (!sec || !list) return;

  if (total >= threshold) { sec.classList.add('hidden'); return; }
  sec.classList.remove('hidden');

  const cartKey = _cart.map(i => i.id).sort().join(',');
  if (cartKey === _freeShipRecsLastCartKey && list.children.length > 0) return;
  _freeShipRecsLastCartKey = cartKey;

  const prods = await _loadFreeShipRecs();
  if (!prods.length) { sec.classList.add('hidden'); return; }

  // Filter out items already in cart, prefer cheapest
  const cartIds = new Set(_cart.map(i => i.id));
  const sorted = [...prods].sort((a, b) => a.price - b.price);
  const toShow = sorted.filter(p => !cartIds.has(p.id)).slice(0, 5);
  if (!toShow.length) { sec.classList.add('hidden'); return; }

  list.innerHTML = toShow.map(p => {
    const img = _escapeHtml(p.imageUrl || p.image || '');
    const name = _escapeHtml(p.name || '');
    const id = _escapeHtml(p.id || '');
    const price = Number(p.price || 0);
    return `
    <div class="flex-shrink-0 w-[108px] bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-amber-300 transition-all duration-200">
      <div class="relative">
        <img src="${img}" alt="${name}" class="w-full h-[72px] object-cover" loading="lazy" onerror="this.src='images/logo.webp'">
        <div class="absolute bottom-1 right-1 bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow">฿${price}</div>
      </div>
      <div class="p-1.5">
        <p class="text-[10px] font-semibold text-gray-800 leading-tight mb-1.5" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.4em">${name}</p>
        <button onclick="_addRecToCart(this,'${id}','${name}',${price},'${img}')"
          class="w-full text-[10px] bg-white border border-red-500 hover:bg-red-50 text-red-500 hover:text-red-600 font-bold rounded-lg py-1 transition-colors flex items-center justify-center gap-0.5">
          <i class="ph ph-plus text-[10px]"></i> เพิ่ม
        </button>
      </div>
    </div>`;
  }).join('');
}

function _addRecToCart(btn, id, name, price, img) {
  const existing = _cart.find(i => i.id === id);
  if (existing) { existing.quantity += 1; }
  else { _cart.push({ id, name, price, image: img, quantity: 1 }); }
  _saveCartToStorage();
  _updateCartUI();
  btn.innerHTML = '<i class="ph ph-check text-[10px]"></i> เพิ่มแล้ว';
  btn.style.background = '#16a34a';
  // Remove this product card from list after brief feedback
  setTimeout(() => { btn.closest('.flex-shrink-0')?.remove(); }, 1200);
  _showToast(`เพิ่ม "${name}" ลงตะกร้าแล้ว`);
}
window._addRecToCart = _addRecToCart;

function _updateFreeShippingBar(total) {
  const threshold = Number(localStorage.getItem('btmd_free_shipping_threshold') || 200);
  const bar      = document.getElementById('free-shipping-bar');
  const msgEl    = document.getElementById('free-shipping-msg');
  const pctEl    = document.getElementById('free-shipping-pct');
  const progress = document.getElementById('free-shipping-progress');
  const iconEl   = document.getElementById('free-ship-icon');
  if (!bar || !progress) return;

  const pct = Math.min((total / threshold) * 100, 100);
  progress.style.width = pct + '%';

  _renderFreeShipRecs(total);

  if (total >= threshold) {
    // ฉลอง!
    bar.style.background = 'linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%)';
    bar.style.borderColor = '#bbf7d0';
    if (iconEl) iconEl.textContent = '🎉';
    if (pctEl) { pctEl.textContent = 'ฟรี!'; pctEl.style.color = '#16a34a'; }
    if (msgEl) msgEl.innerHTML = '<span style="color:#15803d;font-weight:700">ยินดีด้วย! คุณได้รับ <span style="text-decoration:underline">ส่งฟรี</span> แล้ว</span>';
    progress.style.background = 'linear-gradient(90deg,#4ade80,#16a34a)';
  } else {
    const remaining = (threshold - total).toFixed(0);
    const ratio = pct / 100;
    // gradient เปลี่ยนสีตาม progress: เหลือง → ส้ม → แดง
    const r1 = Math.round(245 + (239 - 245) * ratio);
    const g1 = Math.round(158 + (68  - 158) * ratio);
    const b1 = Math.round(11  + (68  -  11) * ratio);
    const r2 = Math.round(239 + (220 - 239) * ratio);
    const g2 = Math.round(68  + (38  -  68) * ratio);
    const b2 = Math.round(68  + (38  -  68) * ratio);
    progress.style.background = `linear-gradient(90deg,rgb(${r1},${g1},${b1}),rgb(${r2},${g2},${b2}))`;
    bar.style.background = 'linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%)';
    bar.style.borderColor = '#fde68a';
    if (iconEl) iconEl.textContent = '🚚';
    if (pctEl) { pctEl.textContent = Math.round(pct) + '%'; pctEl.style.color = '#d97706'; }
    if (msgEl) msgEl.innerHTML = `เพิ่มอีก <strong style="color:#92400e">฿${remaining}</strong> เพื่อ <span style="color:#ea580c">ส่งฟรี!</span>`;
  }
}


function _syncCartItemToServer(method, id, body) {
  const token = localStorage.getItem('btmusicdrive_token');
  if (!token) return;
  const opts = {
    method,
    headers: { 'Authorization': `Bearer ${token}` }
  };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  fetch(`${API_BASE}/cart/items/${id}`, opts).catch(e => console.error('Cart sync error:', e));
}

function _removeFromCart(id) {
  _cart = _cart.filter(i => i.id !== id);
  _saveCartToStorage();
  _updateCartUI();
  _syncCartItemToServer('DELETE', id);
}
window._removeFromCart = _removeFromCart;

function _updateQty(id, delta) {
  const item = _cart.find(i => i.id === id);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity < 1) { _removeFromCart(id); return; }
  _saveCartToStorage();
  _updateCartUI();
  _syncCartItemToServer('PUT', id, { quantity: item.quantity });
}
window._updateQty = _updateQty;

function _loadCartFromStorage() {
  try { _cart = JSON.parse(localStorage.getItem('btmusicdrive_cart') || '[]'); } catch { _cart = []; }
}
window._loadCartFromStorage = _loadCartFromStorage;

function _saveCartToStorage() {
  localStorage.setItem('btmusicdrive_cart', JSON.stringify(_cart));
}
window._saveCartToStorage = _saveCartToStorage;

// ── Toast ────────────────────────────────────────────────────────────────────

function _showToast(message) {
  let c = document.getElementById('toast-container');
  if (!c) { c = document.createElement('div'); c.id = 'toast-container'; c.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none'; document.body.appendChild(c); }
  const t = document.createElement('div');
  t.className = 'bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 transform translate-y-10 opacity-0 transition-all duration-300';
  t.innerHTML = `<div class="bg-green-500 rounded-full p-1"><i class="ph ph-check text-white"></i></div><p class="text-sm font-medium">${_escapeHtml(message)}</p>`;
  c.appendChild(t);
  requestAnimationFrame(() => { t.classList.remove('translate-y-10','opacity-0'); t.classList.add('translate-y-0','opacity-100'); });
  setTimeout(() => { t.classList.remove('translate-y-0','opacity-100'); t.classList.add('translate-y-10','opacity-0'); setTimeout(() => t.remove(), 300); }, 3000);
}

// ── Event Setup & Init ──────────────────────────────────────────────────────

function _setupSharedEvents() {
  const cartBtn = document.getElementById('cart-btn');
  const closeCart = document.getElementById('close-cart-btn');
  const cartOverlay = document.getElementById('cart-overlay');
  const authBtn = document.getElementById('auth-btn');
  const closeAuth = document.getElementById('close-auth-btn');
  const authModal = document.getElementById('auth-modal');
  const authToggle = document.getElementById('auth-toggle-btn');
  const authForm = document.getElementById('auth-form');
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const navbar = document.getElementById('navbar');

  cartBtn?.addEventListener('click', (e) => { if (typeof toggleCart === 'function') return; _toggleCart(); });
  closeCart?.addEventListener('click', (e) => { if (typeof toggleCart === 'function') return; _toggleCart(); });
  cartOverlay?.addEventListener('click', () => { if (typeof toggleCart === 'function') return; _toggleCart(); });

  document.getElementById('clear-cart-btn')?.addEventListener('click', () => {
    if (typeof toggleCart === 'function') return; // let script.js handle or ignore
    if (_cart.length === 0) return;
    if (confirm('ลบสินค้าทั้งหมดในตะกร้า?')) {
      _cart = [];
      _saveCartToStorage();
      _updateCartUI();
      const token = localStorage.getItem('btmusicdrive_token');
      if (token) {
        fetch(`${API_BASE}/cart`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } })
          .catch(e => console.error('Clear cart sync error:', e));
      }
    }
  });

  authBtn?.addEventListener('click', () => { if (typeof toggleAuthModal === 'function') return; if (_currentUser) _handleLogout(); else _toggleAuthModal(); });
  closeAuth?.addEventListener('click', () => { if (typeof toggleAuthModal === 'function') return; _toggleAuthModal(); });
  authModal?.addEventListener('click', e => { if (typeof toggleAuthModal === 'function') return; if (e.target === authModal) _toggleAuthModal(); });
  authToggle?.addEventListener('click', () => { if (typeof toggleAuthModal === 'function') return; _isLoginMode = !_isLoginMode; _updateAuthUI(); });
  authForm?.addEventListener('submit', (e) => { if (typeof handleAuthSubmit === 'function') return; _handleAuthSubmit(e); });

  mobileBtn?.addEventListener('click', () => {
    if (typeof toggleCart === 'function') return;
    mobileMenu?.classList.toggle('hidden');
  });

  // Bottom nav events
  const bnavCartBtn = document.getElementById('bnav-cart-btn');
  const bnavAccountBtn = document.getElementById('bnav-account-btn');
  const bnavLogoutBtn = document.getElementById('bnav-logout-btn');
  const bnavLoginBtn = document.getElementById('bnav-login-btn');

  bnavCartBtn?.addEventListener('click', (e) => { e.preventDefault(); _toggleCart(); });
  bnavAccountBtn?.addEventListener('click', () => {
    _toggleAccountDrawer();
  });



  const bnavOverlay = document.getElementById('bnav-account-overlay');
  const bnavClose = document.getElementById('bnav-drawer-close');
  bnavOverlay?.addEventListener('click', () => _toggleAccountDrawer(false));
  bnavClose?.addEventListener('click', () => _toggleAccountDrawer(false));

  bnavLogoutBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('btmusicdrive_token');
    _currentUser = null;
    _checkAuthState();
    _toggleAccountDrawer(false);
    location.href = '/';
  });
  bnavLoginBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    _toggleAccountDrawer(false);
    _toggleAuthModal();
  });

  // Navbar search overlay
  const _searchBtn = document.getElementById('navbar-search-btn');
  const _searchBar = document.getElementById('navbar-search-bar');
  const _searchInput = document.getElementById('navbar-search-input');
  const _searchClose = document.getElementById('navbar-search-close');
  const _searchBackdrop = document.getElementById('search-overlay-backdrop');

  function _openSearch() {
    _searchBar?.classList.remove('-translate-y-full');
    _searchBackdrop?.classList.remove('hidden');
    setTimeout(() => _searchInput?.focus(), 150);
  }
  function _closeSearch() {
    _searchBar?.classList.add('-translate-y-full');
    _searchBackdrop?.classList.add('hidden');
    if (_searchInput) _searchInput.value = '';
  }
  _searchBtn?.addEventListener('click', _openSearch);
  _searchClose?.addEventListener('click', _closeSearch);
  _searchBackdrop?.addEventListener('click', _closeSearch);
  _searchInput?.addEventListener('keydown', e => {
    if (e.key === 'Escape') { _closeSearch(); return; }
    if (e.key === 'Enter') {
      const q = _searchInput.value.trim();
      if (!q) return;
      if (typeof fbq === 'function') fbq('track', 'Search', { search_string: q });
      _closeSearch();
      window.location.href = `/shop?search=${encodeURIComponent(q)}`;
    }
  });

  if (navbar) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 30) {
        navbar.classList.add('shadow-lg', 'backdrop-blur-sm');
        navbar.style.background = 'rgba(15,23,42,0.92)';
      } else {
        navbar.classList.remove('shadow-lg', 'backdrop-blur-sm');
        navbar.style.background = '';
      }
    }, { passive: true });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Don't block on nav menus — let them resolve async alongside other init.
  _loadNavMenus();
  _setupSharedEvents();
  _checkAuthState();
  _loadCartFromStorage();
  _updateCartUI();
  _initCookieConsent();
  // Google Identity SDK is deferred: loads only when auth modal opens
  // (see _toggleAuthModal → _initGoogleSignIn) to keep it off the critical path.
});


function _initCookieConsent() {
  if (localStorage.getItem('btmusicdrive_cookie_consent')) return;

  const banner = document.createElement('div');
  banner.id = 'cookie-consent-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'การแจ้งเตือนการใช้คุกกี้');
  banner.className = 'fixed bottom-4 left-4 right-4 sm:right-auto z-[200] sm:max-w-sm bg-white border border-gray-200 rounded-2xl shadow-2xl p-5 transform translate-y-10 opacity-0 transition-all duration-500';
  banner.innerHTML = `
    <div class="flex items-start gap-3">
      <div class="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <i class="ph ph-cookie text-lg text-amber-600"></i>
      </div>
      <div class="flex-1 min-w-0">
        <h2 class="text-sm font-bold text-gray-900 mb-1">เว็บไซต์นี้ใช้คุกกี้</h2>
        <p class="text-xs text-gray-500 leading-relaxed mb-3">เราใช้คุกกี้จำเป็นเพื่อให้เว็บไซต์ทำงานได้ และคุกกี้วิเคราะห์เพื่อปรับปรุงประสบการณ์ของคุณ
          <a href="/privacy" class="text-primary underline">นโยบายคุกกี้</a>
        </p>
        <div class="flex flex-wrap gap-2">
          <button id="accept-all-cookies" class="px-4 py-1.5 bg-secondary text-white text-xs font-semibold rounded-lg hover:bg-slate-700 transition-colors">ยอมรับทั้งหมด</button>
          <button id="accept-essential-cookies" class="px-4 py-1.5 bg-gray-100 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200 transition-colors">เฉพาะจำเป็น</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(banner);

  requestAnimationFrame(() => {
    banner.classList.remove('translate-y-10', 'opacity-0');
    banner.classList.add('translate-y-0', 'opacity-100');
  });

  const dismiss = (value) => {
    localStorage.setItem('btmusicdrive_cookie_consent', value);
    banner.classList.remove('translate-y-0', 'opacity-100');
    banner.classList.add('translate-y-10', 'opacity-0');
    setTimeout(() => banner.remove(), 500);
  };

  document.getElementById('accept-all-cookies').addEventListener('click', () => {
    dismiss('all');
    _loadMarketingPixels();
    if (typeof gtag === 'function') {
      gtag('consent', 'update', {
        ad_storage: 'granted', ad_user_data: 'granted',
        ad_personalization: 'granted', analytics_storage: 'granted'
      });
    }
  });
  document.getElementById('accept-essential-cookies').addEventListener('click', () => dismiss('essential'));
}

