// One-time: exchange a TikTok for Business auth_code for a long-lived access token.
//
//   npm run ads:tiktok:auth                  → prints the authorize link, then waits for you to paste
//                                              the URL you land on (https://btmusicdrive.com/api/tiktok/callback?auth_code=...)
//   npm run ads:tiktok:auth -- "<that URL>"  → non-interactive (state is not checked in this mode)
//
// Needs TIKTOK_APP_ID + TIKTOK_APP_SECRET in server/.env.local.
// Saves TIKTOK_ADS_ACCESS_TOKEN + TIKTOK_ADVERTISER_IDS back into server/.env.local.
// auth_code expires in ~1 hour and works once — if it fails, authorize again.
const crypto = require('crypto');
const readline = require('readline');
const { REDIRECT_URI, loadEnv, saveEnvLocal, requireEnv, call } = require('./lib/tiktok-ads');

function parseInput(input) {
  const s = input.trim();
  if (!s) return {};
  if (/^https?:\/\//.test(s)) {
    const u = new URL(s);
    return { authCode: u.searchParams.get('auth_code') || u.searchParams.get('code'), state: u.searchParams.get('state') };
  }
  return { authCode: s };
}

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(q, (a) => { rl.close(); resolve(a); }));
}

(async () => {
  loadEnv();
  requireEnv('TIKTOK_APP_ID', 'TIKTOK_APP_SECRET');
  const appId = process.env.TIKTOK_APP_ID;

  let input = process.argv[2];
  let expectedState = null;
  if (!input) {
    expectedState = crypto.randomBytes(12).toString('hex');
    const url = new URL('https://business-api.tiktok.com/portal/auth');
    url.searchParams.set('app_id', appId);
    url.searchParams.set('state', expectedState);
    url.searchParams.set('redirect_uri', REDIRECT_URI);
    console.log('\n1) เปิดลิงก์นี้ในเบราว์เซอร์ แล้วกดอนุญาตบัญชีโฆษณา:\n');
    console.log('   ' + url.toString() + '\n');
    console.log('2) จะเด้งไปหน้า btmusicdrive.com/api/tiktok/callback — ก๊อป URL เต็มจากแถบที่อยู่มาวางที่นี่\n');
    input = await ask('URL: ');
  }

  const { authCode, state } = parseInput(input);
  if (!authCode) throw new Error('ไม่เจอ auth_code ใน URL ที่วาง');
  if (expectedState && state !== expectedState) {
    throw new Error('state ไม่ตรงกับลิงก์ที่เพิ่งสร้าง — อาจเป็น URL เก่าหรือไม่ได้มาจากลิงก์นี้ ลองใหม่อีกรอบ');
  }

  const data = await call('POST', '/oauth2/access_token/', {
    body: { app_id: appId, secret: process.env.TIKTOK_APP_SECRET, auth_code: authCode },
  });
  const advertiserIds = (data.advertiser_ids || []).map(String);
  saveEnvLocal({
    TIKTOK_ADS_ACCESS_TOKEN: data.access_token,
    TIKTOK_ADVERTISER_IDS: advertiserIds.join(','),
  });

  console.log(`\n✓ ได้ token แล้ว — บันทึกลง server/.env.local (บัญชีโฆษณา ${advertiserIds.length} บัญชี)`);
  try {
    const info = await call('GET', '/oauth2/advertiser/get/', {
      token: data.access_token,
      query: { app_id: appId, secret: process.env.TIKTOK_APP_SECRET },
    });
    for (const a of info.list || []) console.log(`  - ${a.advertiser_id}  ${a.advertiser_name}`);
  } catch (e) {
    console.log('  (ดึงชื่อบัญชีไม่ได้: ' + e.message + ')');
  }
  console.log('\nต่อไป: npm run ads:tiktok');
})().catch((e) => {
  console.error('✗ ' + e.message);
  process.exit(1);
});
