// ═══════════════════════════════════════════════════════════════════════════
// components.js — Shared page components for btmusicdrive
// Include on any sub-page that needs navbar, footer, cart, and auth.
// Usage: <script src="components.js"></script>  (at end of <body>)
// ═══════════════════════════════════════════════════════════════════════════

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
        <a href="index.html" class="flex-shrink-0 flex items-center cursor-pointer no-underline">
          <img src="images/logo.png" alt="btmusicdrive" class="h-9 w-9 rounded-full mr-2">
          <span class="font-bold text-xl tracking-tight text-white">btmusicdrive</span>
        </a>
        <div class="hidden md:flex items-center gap-1" id="desktop-nav"></div>
        <div class="hidden md:flex items-center">
          <a href="admin.html" id="admin-nav-link" class="hidden text-gray-300 hover:text-primary transition-colors font-medium flex items-center gap-1 text-sm ml-4">
            <i class="ph ph-shield-check text-base"></i> Admin
          </a>
        </div>
        <div class="flex items-center space-x-4">
          <button class="text-gray-300 hover:text-primary transition-colors"><i class="ph ph-magnifying-glass text-2xl"></i></button>
          <button class="hidden md:block text-gray-300 hover:text-primary transition-colors relative group" id="auth-btn">
            <i class="ph ph-user text-2xl"></i>
            <span id="user-greeting" class="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-white hidden whitespace-nowrap bg-gray-800 px-2 py-1 rounded shadow-sm"></span>
          </button>
          <button class="hidden md:block text-gray-300 hover:text-primary transition-colors relative" id="cart-btn">
            <i class="ph ph-shopping-cart text-2xl"></i>
            <span id="cart-count" class="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">0</span>
          </button>
          <button class="md:hidden text-gray-300 hover:text-primary transition-colors" id="mobile-menu-btn">
            <i class="ph ph-list text-2xl"></i>
          </button>
        </div>
      </div>
    </div>
    <div class="md:hidden hidden bg-secondary border-t border-gray-700 absolute w-full" id="mobile-menu">
      <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3 shadow-lg" id="mobile-nav"></div>
    </div>
  </nav>`;
}

function _cartSidebarHTML() {
  return `
  <div id="cart-sidebar" class="fixed inset-y-0 right-0 max-w-sm w-full bg-white shadow-2xl z-50 transform translate-x-full transition-transform duration-300 ease-in-out flex flex-col">
    <div class="flex items-center justify-between p-4 border-b border-gray-200">
      <h2 class="text-lg font-bold flex items-center"><i class="ph ph-shopping-cart mr-2"></i> ตะกร้าสินค้า</h2>
      <div class="flex items-center gap-3">
        <button id="clear-cart-btn" class="text-xs text-gray-400 hover:text-red-500 transition-colors hidden">ลบทั้งหมด</button>
        <button id="close-cart-btn" class="text-gray-500 hover:text-red-500 transition-colors"><i class="ph ph-x text-2xl"></i></button>
      </div>
    </div>
    <div id="cart-items-container" class="flex-1 overflow-y-auto p-4 space-y-4">
      <div class="text-center text-gray-500 mt-10" id="empty-cart-msg">
        <i class="ph ph-shopping-cart text-6xl mb-4 text-gray-300"></i>
        <p>ตะกร้าของคุณว่างเปล่า</p>
      </div>
    </div>
    <div class="p-4 border-t border-gray-200 bg-gray-50">
      <div class="flex justify-between text-base font-medium text-gray-900 mb-4">
        <p>ยอดรวม</p><p id="cart-total">฿0.00</p>
      </div>
      <button onclick="window.location='checkout.html'" class="w-full bg-primary hover:bg-secondary text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-md flex items-center justify-center gap-2">
        <i class="ph ph-lock-key"></i> ดำเนินการชำระเงิน
      </button>
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
  return `
  <footer class="bg-secondary pt-16 pb-8">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-12 mb-12">

        <!-- Logo + Description + Shop Links -->
<div>
  <div class="flex items-center mb-4 cursor-pointer" onclick="window.location='index.html'">
    <img src="images/logo.png" alt="btmusicdrive" class="h-10 w-10 rounded-full mr-3">
    <span class="font-bold text-2xl tracking-tight text-white">btmusicdrive</span>
  </div>
  <p class="text-gray-400 mb-5 text-sm leading-relaxed">ร้านขายแฟลชไดร์ฟเพลง MP3 คุณภาพเสียง HD รวมเพลงฮิตทุกแนว เสียบปุ๊บฟังปั๊บ</p>
</div>

        <!-- บริการลูกค้า -->
        <div>
          <h4 class="font-bold text-white mb-5 text-base">บริการลูกค้า</h4>
          <ul class="space-y-3">
            <li><a href="shipping.html" class="text-gray-400 hover:text-primary transition-colors text-sm">การจัดส่งสินค้า</a></li>
            <li><a href="warranty.html" class="text-gray-400 hover:text-primary transition-colors text-sm">การรับประกันสินค้า</a></li>
            <li><a href="returns.html" class="text-gray-400 hover:text-primary transition-colors text-sm">การคืนสินค้าและการคืนเงิน</a></li>
            <li><a href="exchange.html" class="text-gray-400 hover:text-primary transition-colors text-sm">การยกเลิกการสั่งซื้อสินค้า</a></li>
            <li><a href="track-order.html" class="text-gray-400 hover:text-primary transition-colors text-sm">เช็คสถานะการจัดส่ง</a></li>
          </ul>
        </div>

        <!-- เกี่ยวกับเรา -->
        <div>
          <h4 class="font-bold text-white mb-5 text-base">เกี่ยวกับเรา</h4>
          <ul class="space-y-3">
            <li><a href="contact.html" class="text-gray-400 hover:text-primary transition-colors text-sm">ติดต่อเรา</a></li>
            <li><a href="about.html" class="text-gray-400 hover:text-primary transition-colors text-sm">เกี่ยวกับเรา</a></li>
            <li><a href="faq.html" class="text-gray-400 hover:text-primary transition-colors text-sm">คำถามที่พบบ่อย</a></li>
            <li><a href="terms.html" class="text-gray-400 hover:text-primary transition-colors text-sm">ข้อกำหนดและเงื่อนไข</a></li>
            <li><a href="privacy.html" class="text-gray-400 hover:text-primary transition-colors text-sm">นโยบายความเป็นส่วนตัว</a></li>
          </ul>
        </div>

        <!-- ติดต่อเรา -->
        <div>
          <h4 class="font-bold text-white mb-5 text-base">ติดต่อเรา</h4>
          <ul class="space-y-3 text-gray-400 text-sm">
            <li class="flex items-center gap-3"><i class="ph ph-envelope text-lg text-primary"></i><span>contact@btmusicdrive.com</span></li>
          </ul>
          <div class="flex space-x-3 mt-5">
            <a href="https://www.facebook.com/buythrrm1992" target="_blank" rel="noopener" title="Facebook"
               class="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg transition-all duration-200 hover:scale-110"
               style="background:linear-gradient(135deg,#1877f2,#0c5fd8);">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22 12c0-5.522-4.477-10-10-10S2 6.478 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987H7.898V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/>
              </svg>
            </a>
            <a href="https://page.line.me/bt1992?openQrModal=true" target="_blank" rel="noopener" title="Line"
               class="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg transition-all duration-200 hover:scale-110"
               style="background:linear-gradient(135deg,#06c755,#059d43);">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
              </svg>
            </a>
          </div>
        </div>

      </div>

      <!-- Bottom Bar -->
      <div class="border-t border-gray-700 pt-6 hidden md:flex flex-col md:flex-row justify-between items-center gap-4">
        <p class="text-gray-500 text-sm">&copy; 2026 btmusicdrive สงวนลิขสิทธิ์ทุกประการ</p>
        <div class="flex items-center gap-4 text-gray-500 text-xs">
          <a href="terms.html" class="hover:text-white transition-colors">ข้อกำหนดและเงื่อนไข</a>
          <span>|</span>
          <a href="privacy.html" class="hover:text-white transition-colors">นโยบายความเป็นส่วนตัว</a>
        </div>
      </div>
    </div>
  </footer>`;
}

function _mobileBottomNavHTML() {
  return `
  <nav id="mobile-bottom-nav" class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 md:hidden">
    <div class="flex justify-around items-center h-14">
      <a href="index.html" class="flex flex-col items-center justify-center flex-1 py-1 text-gray-500 hover:text-primary transition-colors" id="bnav-home">
        <i class="ph ph-house text-xl"></i>
        <span class="text-[10px] mt-0.5">หน้าแรก</span>
      </a>
      <a href="shop.html" class="flex flex-col items-center justify-center flex-1 py-1 text-gray-500 hover:text-primary transition-colors">
        <i class="ph ph-squares-four text-xl"></i>
        <span class="text-[10px] mt-0.5">หมวดหมู่</span>
      </a>
      <a href="cart.html" class="flex flex-col items-center justify-center flex-1 py-1 text-gray-500 hover:text-primary transition-colors relative" id="bnav-cart-btn">
        <i class="ph ph-shopping-cart text-xl"></i>
        <span id="bnav-cart-count" class="absolute top-0 right-1/4 bg-red-500 text-white text-[9px] font-bold rounded-full h-3.5 w-3.5 flex items-center justify-center">0</span>
        <span class="text-[10px] mt-0.5">ตะกร้า</span>
      </a>
      <button class="flex flex-col items-center justify-center flex-1 py-1 text-gray-500 hover:text-primary transition-colors" id="bnav-account-btn">
        <i class="ph ph-user-circle text-xl"></i>
        <span class="text-[10px] mt-0.5">บัญชี</span>
      </button>
    </div>
  </nav>

  <!-- Mobile Account Sidebar Drawer -->
  <div id="bnav-account-overlay" class="fixed inset-0 bg-black/50 z-[55] hidden transition-opacity duration-300 md:hidden"></div>
  <div id="bnav-account-menu" class="fixed inset-y-0 right-0 w-[85%] max-w-sm bg-white z-[56] transform translate-x-full transition-transform duration-300 ease-in-out md:hidden flex flex-col shadow-2xl">
    <!-- Header -->
    <div class="bg-secondary text-white p-5 pb-6 relative">
      <button id="bnav-drawer-close" class="absolute top-3 right-3 text-white/70 hover:text-white transition-colors">
        <i class="ph ph-x text-2xl"></i>
      </button>
      <div class="flex items-center gap-3 mt-2">
        <div class="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center overflow-hidden" id="bnav-avatar">
          <i class="ph ph-user text-3xl text-white/80"></i>
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-bold text-base truncate" id="bnav-user-name">ยังไม่ได้เข้าสู่ระบบ</p>
          <p class="text-white/60 text-xs truncate" id="bnav-user-email"></p>
        </div>
      </div>
      <!-- Stats -->
      <div class="flex gap-4 mt-4" id="bnav-stats">
        <div class="text-center flex-1">
          <p class="text-lg font-bold text-primary" id="bnav-order-count">0</p>
          <p class="text-[10px] text-white/60">คำสั่งซื้อ</p>
        </div>
        <div class="text-center flex-1">
          <p class="text-lg font-bold text-primary" id="bnav-wishlist-count">0</p>
          <p class="text-[10px] text-white/60">รายการที่ถูกใจ</p>
        </div>
        <div class="text-center flex-1">
          <p class="text-lg font-bold text-primary" id="bnav-review-count">0</p>
          <p class="text-[10px] text-white/60">รีวิว</p>
        </div>
      </div>
    </div>

    <!-- Menu Items -->
    <div class="flex-1 overflow-y-auto">
      <!-- รายการ -->
      <div class="px-4 pt-4 pb-1">
        <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">รายการ</p>
      </div>
      <a href="orders.html" class="flex items-center gap-3 px-5 py-3 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors">
        <i class="ph ph-package text-xl text-gray-400"></i> คำสั่งซื้อ
        <i class="ph ph-caret-right text-gray-300 ml-auto"></i>
      </a>
      <a href="wishlist.html" class="flex items-center gap-3 px-5 py-3 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors">
        <i class="ph ph-heart text-xl text-gray-400"></i> สินค้าที่ถูกใจ
        <i class="ph ph-caret-right text-gray-300 ml-auto"></i>
      </a>
      <a href="track-order.html" class="flex items-center gap-3 px-5 py-3 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors">
        <i class="ph ph-truck text-xl text-gray-400"></i> ติดตามพัสดุ
        <i class="ph ph-caret-right text-gray-300 ml-auto"></i>
      </a>

      <div class="h-px bg-gray-100 mx-4 my-2"></div>

      <!-- บัญชี -->
      <div class="px-4 pt-2 pb-1">
        <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">บัญชี</p>
      </div>
      <a href="profile.html" class="flex items-center gap-3 px-5 py-3 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors">
        <i class="ph ph-user-circle text-xl text-gray-400"></i> ข้อมูลส่วนตัว
        <i class="ph ph-caret-right text-gray-300 ml-auto"></i>
      </a>
      <a href="address.html" class="flex items-center gap-3 px-5 py-3 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors">
        <i class="ph ph-map-pin text-xl text-gray-400"></i> ที่อยู่สำหรับจัดส่ง
        <i class="ph ph-caret-right text-gray-300 ml-auto"></i>
      </a>

      <div class="h-px bg-gray-100 mx-4 my-2"></div>

      <!-- ช่วยเหลือ -->
      <div class="px-4 pt-2 pb-1">
        <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">ช่วยเหลือ</p>
      </div>
      <a href="contact.html" class="flex items-center gap-3 px-5 py-3 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors">
        <i class="ph ph-chat-circle-dots text-xl text-gray-400"></i> ติดต่อเรา
        <i class="ph ph-caret-right text-gray-300 ml-auto"></i>
      </a>
      <a href="about.html" class="flex items-center gap-3 px-5 py-3 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors">
        <i class="ph ph-info text-xl text-gray-400"></i> เกี่ยวกับเรา
        <i class="ph ph-caret-right text-gray-300 ml-auto"></i>
      </a>
    </div>

    <!-- Bottom: Logout / Login -->
    <div class="border-t border-gray-100 p-4">
      <a href="#" id="bnav-logout-btn" class="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-red-500 bg-red-50 hover:bg-red-100 active:bg-red-200 transition-colors">
        <i class="ph ph-sign-out text-lg"></i> ออกจากระบบ
      </a>
      <a href="#" id="bnav-login-btn" class="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-secondary active:bg-slate-800 transition-colors">
        <i class="ph ph-sign-in text-lg"></i> เข้าสู่ระบบ
      </a>
    </div>
  </div>`;
}



function _highlightActiveSidebar() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.sidebar-link[data-page]').forEach(link => {
    const page = link.getAttribute('data-page');
    if (path.startsWith(page)) link.classList.add('active');
    else link.classList.remove('active');
  });
  // Also highlight bottom nav
  const bnavHome = document.getElementById('bnav-home');
  if (bnavHome && path.startsWith('index')) bnavHome.classList.add('text-primary');
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
          li.innerHTML = `<a href="category.html?cat=${encodeURIComponent(c.name)}" class="text-gray-500 hover:text-primary transition-colors">${c.name}</a>`;
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

  _highlightActiveSidebar();

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
  { label: 'หน้าแรก', url: 'index.html', icon: 'ph ph-house' },
  { label: 'ร้านค้า', url: 'shop.html', icon: 'ph ph-storefront' },
  { label: 'หมวดหมู่', url: '#', icon: 'ph ph-squares-four', children: [
    { label: 'สินค้าทั้งหมด', url: 'shop.html', icon: 'ph ph-package' },
    { label: 'เพื่อชีวิต', url: 'category.html?cat=เพื่อชีวิต', icon: 'ph ph-microphone-stage' },
    { label: 'เพลงสตริง', url: 'category.html?cat=เพลงสตริง', icon: 'ph ph-music-notes' },
    { label: 'ลูกทุ่ง', url: 'category.html?cat=ลูกทุ่ง', icon: 'ph ph-vinyl-record' },
    { label: 'หมอลำ', url: 'category.html?cat=หมอลำ', icon: 'ph ph-speaker-high' },
    { label: 'เพลงสากล', url: 'category.html?cat=เพลงสากล', icon: 'ph ph-globe' },
    { label: 'ลูกกรุง', url: 'category.html?cat=ลูกกรุง', icon: 'ph ph-music-note' },
  ]},
  { label: 'เกี่ยวกับ', url: 'about.html', icon: 'ph ph-info' },
  { label: 'ติดตามพัสดุ', url: 'track-order.html', icon: 'ph ph-package' },
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
  if (!desktop || !mobile) return;

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

  mobile.innerHTML = menus.map(m => {
    const icon = m.icon ? `<i class="${m.icon}"></i>` : '';
    let html = `<a href="${m.url}" class="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-primary hover:bg-white/10 flex items-center gap-2">${icon} ${m.label}</a>`;
    if (m.children && m.children.length > 0) {
      html += m.children.map(c =>
        `<a href="${c.url}" class="block pl-8 pr-3 py-2 rounded-md text-sm text-gray-400 hover:text-primary hover:bg-white/10 flex items-center gap-2">${c.icon ? `<i class="${c.icon}"></i>` : ''}${c.label}</a>`
      ).join('');
    }
    return html;
  }).join('') + `<a href="admin.html" id="admin-nav-link-mobile" class="hidden px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-primary hover:bg-white/10 flex items-center gap-2"><i class="ph ph-shield-check"></i> Admin Dashboard</a>`;
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
  if (!countEl) return;

  const totalItems = _cart.reduce((s, i) => s + i.quantity, 0);
  countEl.textContent = totalItems;

  // Update bottom nav cart count
  const bnavCount = document.getElementById('bnav-cart-count');
  if (bnavCount) bnavCount.textContent = totalItems;

  const clearBtn = document.getElementById('clear-cart-btn');

  if (_cart.length === 0) {
    if (emptyMsg) emptyMsg.style.display = 'block';
    if (container) { container.innerHTML = ''; container.appendChild(emptyMsg); }
    if (totalEl) totalEl.textContent = '\u0E3F0.00';
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
  if (totalEl) totalEl.textContent = `\u0E3F${total.toFixed(2)}`;
}

function _updateWishlistBadge() {
  const wishlist = JSON.parse(localStorage.getItem('btmusicdrive_wishlist') || '[]');
  const count = wishlist.length;
  const el = document.getElementById('sidebar-wishlist-count');
  if (el) {
    el.textContent = count;
    el.classList.toggle('hidden', count === 0);
  }
}

function _removeFromCart(id) {
  _cart = _cart.filter(i => i.id !== id);
  _saveCartToStorage();
  _updateCartUI();
}
window._removeFromCart = _removeFromCart;

function _updateQty(id, delta) {
  const item = _cart.find(i => i.id === id);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity < 1) { _removeFromCart(id); return; }
  _saveCartToStorage();
  _updateCartUI();
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
    }
  });

  authBtn?.addEventListener('click', () => { if (typeof toggleAuthModal === 'function') return; if (_currentUser) _handleLogout(); else _toggleAuthModal(); });
  closeAuth?.addEventListener('click', () => { if (typeof toggleAuthModal === 'function') return; _toggleAuthModal(); });
  authModal?.addEventListener('click', e => { if (typeof toggleAuthModal === 'function') return; if (e.target === authModal) _toggleAuthModal(); });
  authToggle?.addEventListener('click', () => { if (typeof toggleAuthModal === 'function') return; _isLoginMode = !_isLoginMode; _updateAuthUI(); });
  authForm?.addEventListener('submit', (e) => { if (typeof handleAuthSubmit === 'function') return; _handleAuthSubmit(e); });

  mobileBtn?.addEventListener('click', () => mobileMenu?.classList.toggle('hidden'));

  // Bottom nav events
  const bnavCartBtn = document.getElementById('bnav-cart-btn');
  const bnavAccountBtn = document.getElementById('bnav-account-btn');
  const bnavLogoutBtn = document.getElementById('bnav-logout-btn');
  const bnavLoginBtn = document.getElementById('bnav-login-btn');

  bnavCartBtn?.addEventListener('click', _toggleCart);
  bnavAccountBtn?.addEventListener('click', () => {
    _toggleAccountDrawer();
  });



  const bnavOverlay = document.getElementById('bnav-account-overlay');
  const bnavClose = document.getElementById('bnav-drawer-close');
  bnavOverlay?.addEventListener('click', () => _toggleAccountDrawer(false));
  bnavClose?.addEventListener('click', () => _toggleAccountDrawer(false));

  document.addEventListener('click', (e) => {
    // No-op: drawer uses overlay
  });
  bnavLogoutBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    _currentUser = null;
    _checkAuthState();
    _toggleAccountDrawer(false);
    location.href = 'index.html';
  });
  bnavLoginBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    _toggleAccountDrawer(false);
    _toggleAuthModal();
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

document.addEventListener('DOMContentLoaded', async () => {
  _initGoogleSignIn();
  await _loadNavMenus();
  _setupSharedEvents();
  _checkAuthState();
  _loadCartFromStorage();
  _updateCartUI();
  _updateWishlistBadge();
});
