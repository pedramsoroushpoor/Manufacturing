// تست دودی برای صفحه‌ی Login / سیستم نشست gng-mfr-api.
//
// این اسکریپت باید هم‌زمان با یک نمونه‌ی در حال اجرای gng-mfr-api (npm start
// یا RUN-API.ps1) اجرا شود. اطلاعات اتصال «درست» را از همان .env این پروژه
// می‌خواند — یعنی برای این‌که تست ورود واقعاً موفق شود، DB_SERVER/DB_USER/
// DB_PASSWORD باید به یک SQL Server واقعاً در دسترس اشاره کنند.
//
// اجرا: node smoke-test.js [آدرس پایه‌ی API، پیش‌فرض http://localhost:4311]
//
// پنج آزمایش:
//   1) ورود با اطلاعات درست   (POST /api/connect)
//   2) خواندن نشست باز        (GET  /api/session)
//   3) رد شدن رمز غلط         (POST /api/connect با رمز اشتباه)
//   4) رد شدن توکن نامعتبر     (GET  /api/session با یک توکن ساختگی)
//   5) خروج                   (DELETE /api/session ، سپس تأیید بسته‌شدنش)

const fs = require('fs');
const path = require('path');

const BASE = process.argv[2] || process.env.SMOKE_API_BASE || 'http://localhost:4311';

function readEnv() {
  const file = path.resolve(__dirname, '.env');
  const env = {};
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq > 0) env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  }
  return env;
}

const env = readEnv();
const GOOD = {
  server: env.DB_SERVER || '10.0.0.1',
  port: Number(env.DB_PORT || 1433),
  database: env.DB_DATABASE || 'GNG_AI_Dev',
  auth: 'sql',
  user: env.DB_USER || '',
  password: env.DB_PASSWORD || '',
  encrypt: (env.DB_ENCRYPT || 'false').toLowerCase() === 'true',
};

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const mark = ok ? '✔' : '✘';
  console.log(`  ${mark}  ${name}${detail ? ' — ' + detail : ''}`);
}

async function post(pathname, body, token) {
  const res = await fetch(BASE + pathname, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-alm-session': token } : {}),
    },
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* بدون بدنه‌ی JSON */
  }
  return { status: res.status, json };
}

async function get(pathname, token) {
  const res = await fetch(BASE + pathname, {
    headers: token ? { 'x-alm-session': token } : {},
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* بدون بدنه‌ی JSON */
  }
  return { status: res.status, json };
}

async function del(pathname, token) {
  const res = await fetch(BASE + pathname, {
    method: 'DELETE',
    headers: token ? { 'x-alm-session': token } : {},
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* بدون بدنه‌ی JSON */
  }
  return { status: res.status, json };
}

async function main() {
  console.log(`\ngng-mfr-api smoke test — ${BASE}`);
  console.log(`اطلاعات اتصالِ «درست» از .env: ${GOOD.server},${GOOD.port}/${GOOD.database} به‌عنوان ${GOOD.user || '(خالی)'}\n`);

  // 0) health — پیش‌شرط: بک‌اند اصلاً بالاست؟
  try {
    const h = await get('/api/health');
    record('بک‌اند در دسترس است (GET /api/health)', h.status === 200 && h.json?.ok === true, `HTTP ${h.status}`);
  } catch (err) {
    record('بک‌اند در دسترس است (GET /api/health)', false, err.message);
    console.log('\nبدون بک‌اند در حال اجرا، بقیه‌ی تست‌ها معنی ندارند. متوقف شد.\n');
    printSummary();
    process.exit(1);
  }

  // 1) ورود با اطلاعات درست
  let token = null;
  try {
    const r = await post('/api/connect', GOOD);
    token = r.json?.token || null;
    record(
      '۱) ورود با اطلاعات درست (POST /api/connect)',
      r.status === 200 && !!token,
      r.status === 200 ? `توکن دریافت شد` : `HTTP ${r.status} — ${r.json?.error || 'بدون پیام'}`
    );
  } catch (err) {
    record('۱) ورود با اطلاعات درست (POST /api/connect)', false, err.message);
  }

  // 2) خواندن نشست باز
  if (token) {
    try {
      const r = await get('/api/session', token);
      const matches = r.json?.server === GOOD.server && r.json?.database === GOOD.database;
      record('۲) خواندن نشست باز (GET /api/session)', r.status === 200 && matches, `HTTP ${r.status}`);
    } catch (err) {
      record('۲) خواندن نشست باز (GET /api/session)', false, err.message);
    }
  } else {
    record('۲) خواندن نشست باز (GET /api/session)', false, 'رد شد چون تست ۱ توکنی نداد');
  }

  // 3) رد شدن رمز غلط
  try {
    const r = await post('/api/connect', { ...GOOD, password: (GOOD.password || '') + 'x-not-the-real-password' });
    record('۳) رد شدن رمز غلط (POST /api/connect)', r.status === 400 && !r.json?.token, `HTTP ${r.status} — ${r.json?.error || ''}`);
  } catch (err) {
    record('۳) رد شدن رمز غلط (POST /api/connect)', false, err.message);
  }

  // 4) رد شدن توکن نامعتبر — نیازی به دیتابیس واقعی ندارد
  try {
    const r = await get('/api/session', 'this-token-was-never-issued-by-the-server');
    record('۴) رد شدن توکن نامعتبر (GET /api/session)', r.status === 401 && r.json?.code === 'no-session', `HTTP ${r.status} — code=${r.json?.code}`);
  } catch (err) {
    record('۴) رد شدن توکن نامعتبر (GET /api/session)', false, err.message);
  }

  // 5) خروج، و تأیید این‌که نشست واقعاً بسته شده
  if (token) {
    try {
      const r = await del('/api/session', token);
      let reallyClosed = false;
      if (r.status === 200 && r.json?.ok) {
        const after = await get('/api/session', token);
        reallyClosed = after.status === 401;
      }
      record('۵) خروج (DELETE /api/session)', r.status === 200 && r.json?.ok && reallyClosed, `HTTP ${r.status}، بعد از خروج: ${reallyClosed ? '401 (بسته شد)' : 'هنوز باز است!'}`);
    } catch (err) {
      record('۵) خروج (DELETE /api/session)', false, err.message);
    }
  } else {
    record('۵) خروج (DELETE /api/session)', false, 'رد شد چون تست ۱ توکنی نداد');
  }

  printSummary();
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}

function printSummary() {
  const passed = results.filter((r) => r.ok).length;
  console.log(`\nنتیجه: ${passed} از ${results.length} تست موفق.\n`);
}

main().catch((err) => {
  console.error('خطای غیرمنتظره در اجرای تست دودی:', err);
  process.exit(1);
});
