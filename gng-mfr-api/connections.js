const fs = require('fs');
const path = require('path');

/**
 * فهرست دیتابیس‌هایی که این نصب قبلاً باز کرده، در یک فایل کنار پروژه —
 * نه در مرورگر و نه در خودِ یک دیتابیس.
 *
 * سه دلیل برای این‌جا نگه‌داشتنش، نه جای دیگر:
 *   - یک دیتابیس نمی‌تواند فهرست دیتابیس‌هایی که ممکن است بخواهید باز کنید را
 *     نگه دارد؛
 *   - حافظه‌ی مرورگر مخصوص همان مرورگر است و با پاک‌کردن کش از بین می‌رود؛
 *   - یک فایل کنار برنامه چیزی است که یک کاربر فنی می‌تواند بخواند و ویرایش کند.
 *
 * رمز عبور هرگز نوشته نمی‌شود. فایل فقط آدرس و نام کاربری نگه می‌دارد — با
 * این‌حال در gitignore است، چون نام سرور و لاگین به کسی دیگر ربطی ندارد.
 */

const FILE =
  process.env.GNG_MFR_CONNECTIONS || path.resolve(__dirname, 'gng-mfr.connections.json');

const MAX = 20;

const connectionsFile = () => FILE;

/** شناسه‌ای پایدار برای یک جفت سرور+دیتابیس، تا ذخیره‌ی دوباره جای قبلی را عوض کند. */
const idOf = (server, database) => `${server.trim().toLowerCase()}::${database.trim().toLowerCase()}`;

function loadConnections() {
  if (!fs.existsSync(FILE)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((c) => c && c.server && c.database)
      .sort((a, b) => String(b.lastUsed || '').localeCompare(String(a.lastUsed || '')));
  } catch (err) {
    console.error(`[connections] ${FILE} is not valid JSON -> ${err.message}`);
    return [];
  }
}

function save(list) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(list.slice(0, MAX), null, 2), 'utf8');
  } catch (err) {
    console.error(`[connections] could not write ${FILE} -> ${err.message}`);
  }
}

/** ثبت اتصالی که همین الان با موفقیت کار کرد. بعد از ورود موفق فراخوانی می‌شود. */
function rememberConnection(entry) {
  const id = idOf(entry.server, entry.database);
  const saved = {
    id,
    server: entry.server.trim(),
    port: entry.port,
    database: entry.database.trim(),
    auth: entry.auth,
    user: entry.user || '',
    domain: entry.domain || '',
    lastUsed: new Date().toISOString(),
  };
  const rest = loadConnections().filter((c) => c.id !== id);
  const list = [saved, ...rest];
  save(list);
  return list;
}

function forgetConnection(id) {
  const list = loadConnections().filter((c) => c.id !== id);
  save(list);
  return list;
}

module.exports = {
  connectionsFile,
  loadConnections,
  rememberConnection,
  forgetConnection,
};
