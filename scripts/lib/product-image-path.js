'use strict';

/**
 * คืนชื่อโฟลเดอร์รูปสินค้าจากทั้ง URL แบบเดิมและ R2 CDN URL
 *
 * /images/products/<slug>/<file>.webp
 * https://img.btmusicdrive.com/web/products/<slug>/<file>.webp
 */
function imageSlugFromUrl(value) {
  const path = String(value || '').split('?')[0];
  const match = path.match(/\/(?:web\/)?images\/products\/([^/]+)\//)
    || path.match(/\/web\/products\/([^/]+)\//);
  return match ? decodeURIComponent(match[1]) : '';
}

module.exports = { imageSlugFromUrl };
