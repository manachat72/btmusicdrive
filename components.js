// ═══════════════════════════════════════════════════════════════════════════
// components.js — Shared page components for btmusicdrive
// Include on any sub-page that needs navbar, footer, cart, and auth.
// Usage: <script src="components.js"></script>  (at end of <body>)
// ═══════════════════════════════════════════════════════════════════════════

const API_BASE = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
  ? 'http://localhost:5000/api' : '/api';
const GOOGLE_CLIENT_ID = '46644504211-991ljdkldsbsb08d9aki6v8aeafrnp6k.apps.googleusercontent.com';

let _currentUser = null;
let _cart = [];
let _isLoginMode = true;
let _googleSdkPromise = null;
let _googleInitialized = false;

// ── HTML Templates ──────────────────────────────────────────────────────────

function _navbarHTML() {
  return `
  <nav class="bg-white shadow-sm fixed w-full z-50 top-0 transition-all duration-300" id="navbar">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16 items-center">
        <a href="index.html" class="flex-shrink-0 flex items-center cursor-pointer no-underline">
          <img src="images/logo (60 x 60 px) (1).png" alt="btmusicdrive" class="h-9 w-9 rounded-full mr-2">
          <span class="font-bold text-xl tracking-tight text-gray-900">btmusicdrive</span>
        </a>
        <div class="hidden md:flex items-center gap-1" id="desktop-nav"></div>
        <div class="hidden md:flex items-center">
          <a href="admin.html" id="admin-nav-link" class="hidden text-secondary hover:text-primary transition-colors font-medium flex items-center gap-1 text-sm ml-4">
            <i class="ph ph-shield-check text-base"></i> Admin
          </a>
        </div>
        <div class="flex items-center space-x-4">
          <button class="text-gray-600 hover:text-primary transition-colors"><i class="ph ph-magnifying-glass text-2xl"></i></button>
          <button class="text-gray-600 hover:text-primary transition-colors relative group" id="auth-btn">
            <i class="ph ph-user text-2xl"></i>
            <span id="user-greeting" class="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-gray-900 hidden whitespace-nowrap bg-white px-2 py-1 rounded shadow-sm"></span>
          </button>
          <button class="text-gray-600 hover:text-primary transition-colors relative" id="cart-btn">
            <i class="ph ph-shopping-cart text-2xl"></i>
            <span id="cart-count" class="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">0</span>
          </button>
          <button class="md:hidden text-gray-600 hover:text-primary transition-colors" id="mobile-menu-btn">
            <i class="ph ph-list text-2xl"></i>
          </button>
        </div>
      </div>
    </div>
    <div class="md:hidden hidden bg-white border-t border-gray-100 absolute w-full" id="mobile-menu">
      <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3 shadow-lg" id="mobile-nav"></div>
    </div>
  </nav>`;
}

function _cartSidebarHTML() {
  return `
  <div id="cart-sidebar" class="fixed inset-y-0 right-0 max-w-sm w-full bg-white shadow-2xl z-50 transform translate-x-full transition-transform duration-300 ease-in-out flex flex-col">
    <div class="flex items-center justify-between p-4 border-b border-gray-200">
      <h2 class="text-lg font-bold flex items-center"><i class="ph ph-shopping-cart mr-2"></i> Your Cart</h2>
      <button id="close-cart-btn" class="text-gray-500 hover:text-red-500 transition-colors"><i class="ph ph-x text-2xl"></i></button>
    </div>
    <div id="cart-items-container" class="flex-1 overflow-y-auto p-4 space-y-4">
      <div class="text-center text-gray-500 mt-10" id="empty-cart-msg">
        <i class="ph ph-shopping-cart text-6xl mb-4 text-gray-300"></i>
        <p>Your cart is empty.</p>
      </div>
    </div>
    <div class="p-4 border-t border-gray-200 bg-gray-50">
      <div class="flex justify-between text-base font-medium text-gray-900 mb-4">
        <p>Subtotal</p><p id="cart-total">\u0E3F0.00</p>
      </div>
      <p class="text-sm text-gray-500 mb-4">Shipping and taxes calculated at checkout.</p>
      <button onclick="window.location='checkout.html'" class="w-full bg-primary hover:bg-secondary text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-md flex items-center justify-center gap-2">
        <i class="ph ph-lock-key"></i> Checkout
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
            <button onclick="_loginFacebook()" id="fb-login-btn" class="w-full flex items-center justify-center gap-3 bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold py-3 px-4 rounded-xl transition-colors">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              \u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E14\u0E49\u0E27\u0E22 Facebook
            </button>
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
  <footer class="bg-gray-50 pt-16 pb-8 border-t border-gray-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
        <div>
          <div class="flex items-center mb-6 cursor-pointer">
            <img src="images/logo (60 x 60 px) (1).png" alt="btmusicdrive" class="h-9 w-9 rounded-full mr-2">
            <span class="font-bold text-2xl tracking-tight text-gray-900">btmusicdrive</span>
          </div>
          <p class="text-gray-500 mb-6">ร้านขายแฟลชไดร์ฟเพลง MP3 คุณภาพเสียง HD รวมเพลงฮิตทุกแนว เสียบปุ๊บฟังปั๊บ</p>
          <div class="flex space-x-4">
            <a href="#" class="text-gray-400 hover:text-primary transition-colors"><i class="ph-fill ph-facebook-logo text-2xl"></i></a>
            <a href="#" class="text-gray-400 hover:text-primary transition-colors"><i class="ph-fill ph-tiktok-logo text-2xl"></i></a>
            <a href="#" class="text-gray-400 hover:text-primary transition-colors"><i class="ph-fill ph-instagram-logo text-2xl"></i></a>
            <a href="#" class="text-gray-400 hover:text-primary transition-colors"><i class="ph-fill ph-youtube-logo text-2xl"></i></a>
          </div>
          <!-- ช้อปได้ที่ -->
          <div class="mt-5">
            <p class="text-xs text-gray-400 mb-2 font-semibold">\u0E0A\u0E49\u0E2D\u0E1B\u0E44\u0E14\u0E49\u0E17\u0E35\u0E48</p>
            <div class="flex flex-wrap gap-2 sm:space-x-3 sm:gap-0">
              <a href="https://www.tiktok.com/@buytrrm1992" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:border-primary hover:text-primary transition-all text-xs font-medium">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.46V13a8.28 8.28 0 005.58 2.16V11.7a4.83 4.83 0 01-3.77-1.24V6.69h3.77z"/></svg>
                TikTok Shop
              </a>
              <a href="https://shopee.co.th/shop/134575937" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:border-[#ee4d2d] hover:text-[#ee4d2d] transition-all text-xs font-medium">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C9.24 2 7 4.24 7 7H5c-1.1 0-2 .9-2 2v10c0 1.66 1.34 3 3 3h12c1.66 0 3-1.34 3-3V9c0-1.1-.9-2-2-2h-2c0-2.76-2.24-5-5-5zm0 2c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm0 6c1.38 0 2.5-1.12 2.5-2.5h1.5c0 2.21-1.79 4-4 4s-4-1.79-4-4h1.5C9.5 8.88 10.62 10 12 10z"/></svg>
                Shopee
              </a>
              <a href="https://www.lazada.co.th/shop/buythrrm1992/" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:border-[#0f146d] hover:text-[#0f146d] transition-all text-xs font-medium">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18L19.18 7.5 12 10.82 4.82 7.5 12 4.18zM4 8.72l7 3.5V19l-7-3.5V8.72zm16 0V15.5L13 19v-6.78l7-3.5z"/></svg>
                Lazada
              </a>
            </div>
          </div>
        </div>
        <div>
          <h4 class="font-bold text-gray-900 mb-6 text-lg">หมวดหมู่สินค้า</h4>
          <ul class="space-y-3" id="footer-categories">
            <li><a href="shop.html" class="text-gray-500 hover:text-primary transition-colors">สินค้าทั้งหมด</a></li>
          </ul>
        </div>
        <div>
          <h4 class="font-bold text-gray-900 mb-6 text-lg">ช่วยเหลือ</h4>
          <ul class="space-y-3">
            <li><a href="track-order.html" class="text-gray-500 hover:text-primary transition-colors">ติดตามพัสดุ</a></li>
            <li><a href="contact.html" class="text-gray-500 hover:text-primary transition-colors">ติดต่อเรา</a></li>
            <li><a href="about.html" class="text-gray-500 hover:text-primary transition-colors">เกี่ยวกับเรา</a></li>
          </ul>
        </div>
        <div>
          <h4 class="font-bold text-gray-900 mb-6 text-lg">ติดต่อเรา</h4>
          <ul class="space-y-4 text-gray-500">
            <li class="flex items-start"><i class="ph ph-map-pin text-xl text-primary mr-3 mt-1"></i><span>กรุงเทพมหานคร<br>ประเทศไทย</span></li>
            <li class="flex items-center"><i class="ph ph-phone text-xl text-primary mr-3"></i><span>08X-XXX-XXXX</span></li>
            <li class="flex items-center"><i class="ph ph-chat-circle-dots text-xl text-primary mr-3"></i><span>Line ID: @btmusicdrive</span></li>
            <li class="flex items-center"><i class="ph ph-envelope text-xl text-primary mr-3"></i><span>contact@btmusicdrive.com</span></li>
          </ul>
        </div>
      </div>
      <div class="border-t border-gray-200 pt-8 flex flex-col md:flex-row justify-between items-center">
        <p class="text-gray-500 text-sm mb-4 md:mb-0">&copy; 2026 btmusicdrive. สงวนลิขสิทธิ์ทุกประการ</p>
        <div class="flex space-x-4">
          <i class="ph ph-credit-card text-3xl text-gray-400"></i>
          <i class="ph ph-qr-code text-3xl text-gray-400"></i>
          <i class="ph ph-bank text-3xl text-gray-400"></i>
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
      <button class="flex flex-col items-center justify-center flex-1 py-1 text-gray-500 hover:text-primary transition-colors relative" id="bnav-cart-btn">
        <i class="ph ph-shopping-cart text-xl"></i>
        <span id="bnav-cart-count" class="absolute top-0 right-1/4 bg-red-500 text-white text-[9px] font-bold rounded-full h-3.5 w-3.5 flex items-center justify-center">0</span>
        <span class="text-[10px] mt-0.5">ตะกร้า</span>
      </button>
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

  _highlightActiveSidebar();
})();

// ── Dynamic Navigation Menus ────────────────────────────────────────────────
const _DEFAULT_MENUS = [
  { label: 'หน้าแรก', url: 'index.html', icon: null },
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
  { label: 'เกี่ยวกับ', url: 'about.html', icon: null },
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
        <button class="text-gray-600 hover:text-primary transition-colors font-medium flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-gray-50">${icon}${m.label} <i class="ph ph-caret-down text-xs ml-1"></i></button>
        <div class="absolute left-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">${sub}</div>
      </div>`;
    }
    return `<a href="${m.url}" class="text-gray-600 hover:text-primary transition-colors font-medium flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-gray-50">${icon}${m.label}</a>`;
  }).join('');

  mobile.innerHTML = menus.map(m => {
    const icon = m.icon ? `<i class="${m.icon}"></i> ` : '';
    let html = `<a href="${m.url}" class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary hover:bg-gray-50 flex items-center gap-2">${icon}${m.label}</a>`;
    if (m.children && m.children.length > 0) {
      html += m.children.map(c =>
        `<a href="${c.url}" class="block pl-8 pr-3 py-2 rounded-md text-sm text-gray-600 hover:text-primary hover:bg-gray-50">${c.icon ? `<i class="${c.icon}"></i> ` : ''}${c.label}</a>`
      ).join('');
    }
    return html;
  }).join('') + `<a href="admin.html" id="admin-nav-link-mobile" class="hidden px-3 py-2 rounded-md text-base font-medium text-secondary hover:text-primary hover:bg-amber-50 flex items-center gap-2"><i class="ph ph-shield-check"></i> Admin Dashboard</a>`;
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

function _initFacebookSDK() {
  window.fbAsyncInit = function() { FB.init({ appId: '1234567890', cookie: true, xfbml: true, version: 'v19.0' }); };
}

function _loginFacebook() {
  if (typeof FB === 'undefined') { _showToast('Facebook SDK \u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E1E\u0E23\u0E49\u0E2D\u0E21'); return; }
  FB.login(function(r) { if (r.authResponse) _handleFacebookLogin(r.authResponse.accessToken); }, { scope: 'email,public_profile' });
}
window._loginFacebook = _loginFacebook;

async function _handleFacebookLogin(accessToken) {
  _setAuthLoading(true);
  try {
    const res = await fetch(`${API_BASE}/auth/facebook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Facebook login failed');
    localStorage.setItem('btmusicdrive_token', data.token);
    _currentUser = data.user;
    _updateUserUI(); _toggleAuthModal();
    _showToast('\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E14\u0E49\u0E27\u0E22 Facebook \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08!');
  } catch (err) { _showAuthError(err.message); }
  finally { _setAuthLoading(false); }
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
      avatarEl.innerHTML = `<img src="${user.avatar}" class="w-full h-full object-cover rounded-full" alt="">`;
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

  if (_cart.length === 0) {
    if (emptyMsg) emptyMsg.style.display = 'block';
    if (container) { container.innerHTML = ''; container.appendChild(emptyMsg); }
    if (totalEl) totalEl.textContent = '\u0E3F0.00';
    return;
  }
  if (emptyMsg) emptyMsg.style.display = 'none';
  if (!container) return;

  let total = 0;
  container.innerHTML = '';
  _cart.forEach(item => {
    const sub = item.price * item.quantity;
    total += sub;
    const el = document.createElement('div');
    el.className = 'flex gap-4 py-4 border-b border-gray-100';
    el.innerHTML = `
      <div class="w-20 h-24 flex-shrink-0 bg-gray-100 rounded-md overflow-hidden">
        <img src="${item.image}" alt="${item.name}" class="w-full h-full object-cover">
      </div>
      <div class="flex-1 flex flex-col">
        <div class="flex justify-between">
          <h4 class="text-sm font-bold text-gray-900 line-clamp-2 pr-4">${item.name}</h4>
          <button class="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0" onclick="_removeFromCart('${item.id}')"><i class="ph ph-trash text-lg"></i></button>
        </div>
        <div class="flex justify-between items-end mt-auto pt-2">
          <div class="flex items-center border border-gray-200 rounded-md">
            <button class="px-2 py-1 text-gray-500 hover:text-primary" onclick="_updateQty('${item.id}',-1)"><i class="ph ph-minus text-xs"></i></button>
            <span class="px-2 text-sm font-medium w-8 text-center">${item.quantity}</span>
            <button class="px-2 py-1 text-gray-500 hover:text-primary" onclick="_updateQty('${item.id}',1)"><i class="ph ph-plus text-xs"></i></button>
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
  _updateCartUI();
}
window._removeFromCart = _removeFromCart;

function _updateQty(id, delta) {
  const item = _cart.find(i => i.id === id);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity < 1) { _removeFromCart(id); return; }
  _updateCartUI();
}
window._updateQty = _updateQty;

// ── Toast ────────────────────────────────────────────────────────────────────

function _showToast(message) {
  let c = document.getElementById('toast-container');
  if (!c) { c = document.createElement('div'); c.id = 'toast-container'; c.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none'; document.body.appendChild(c); }
  const t = document.createElement('div');
  t.className = 'bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 transform translate-y-10 opacity-0 transition-all duration-300';
  t.innerHTML = `<div class="bg-green-500 rounded-full p-1"><i class="ph ph-check text-white"></i></div><p class="text-sm font-medium">${message}</p>`;
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

  cartBtn?.addEventListener('click', _toggleCart);
  closeCart?.addEventListener('click', _toggleCart);
  cartOverlay?.addEventListener('click', () => { _toggleCart(); });

  authBtn?.addEventListener('click', () => { if (_currentUser) _handleLogout(); else _toggleAuthModal(); });
  closeAuth?.addEventListener('click', _toggleAuthModal);
  authModal?.addEventListener('click', e => { if (e.target === authModal) _toggleAuthModal(); });
  authToggle?.addEventListener('click', () => { _isLoginMode = !_isLoginMode; _updateAuthUI(); });
  authForm?.addEventListener('submit', _handleAuthSubmit);

  mobileBtn?.addEventListener('click', () => mobileMenu?.classList.toggle('hidden'));

  // Bottom nav events
  const bnavCartBtn = document.getElementById('bnav-cart-btn');
  const bnavAccountBtn = document.getElementById('bnav-account-btn');
  const bnavAccountMenu = document.getElementById('bnav-account-menu');
  const bnavLogoutBtn = document.getElementById('bnav-logout-btn');
  const bnavLoginBtn = document.getElementById('bnav-login-btn');

  bnavCartBtn?.addEventListener('click', _toggleCart);
  bnavAccountBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
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
      if (window.scrollY > 10) navbar.classList.add('shadow-md','bg-opacity-95','backdrop-blur-sm');
      else navbar.classList.remove('shadow-md','bg-opacity-95','backdrop-blur-sm');
    });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  _initFacebookSDK();
  _initGoogleSignIn();
  await _loadNavMenus();
  _setupSharedEvents();
  _checkAuthState();
  _updateCartUI();
  _updateWishlistBadge();
});
