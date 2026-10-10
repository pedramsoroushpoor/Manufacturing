const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');
const sql = require('mssql');

/**
 * یک بک‌اند gng-mfr-api، چند دیتابیس.
 *
 * پیش از این یک pool واحد از .env ساخته می‌شد. حالا به‌ازای هر ورود (Login) یک
 * pool جداگانه باز می‌شود، تا همین بک‌اندِ در حال اجرا بتواند هم‌زمان به چند
 * کاربر که هر کدام سرور/دیتابیس خودشان را انتخاب کرده‌اند سرویس بدهد. توکن
 * نشست در هدر هر درخواست سفر می‌کند؛ middleware همان نشست را در
 * AsyncLocalStorage می‌گذارد و getPool() در server.js از همان‌جا می‌خواندش —
 * به همین دلیل endpointهای موجود (alm/menu ، alm/systems) لازم نیست تغییر کنند.
 *
 * رمز عبور فقط در حافظه و فقط تا وقتی نشست زنده است نگه‌داری می‌شود؛ هیچ‌چیز
 * از یک ورود روی دیسک نوشته نمی‌شود (فهرست اتصال‌های قبلی را connections.js
 * جداگانه و بدون رمز نگه می‌دارد).
 */

const storage = new AsyncLocalStorage();
const sessions = new Map();

/** نشستی که این‌قدر بی‌استفاده مانده بسته می‌شود؛ pool رایگان نیست. */
const IDLE_MS = 8 * 60 * 60 * 1000;

/**
 * @param {{server:string, port?:number, database:string, auth:'sql'|'windows',
 *   user?:string, password?:string, domain?:string, encrypt?:boolean}} input
 * @returns {import('mssql').config}
 */
function buildConfig(input) {
  const base = {
    server: input.server,
    port: input.port || 1433,
    database: input.database,
    options: {
      encrypt: input.encrypt || false,
      trustServerCertificate: true,
      enableArithAbort: true,
    },
    requestTimeout: 60000,
    connectionTimeout: 30000,
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  };

  if (input.auth === 'windows') {
    /* tedious می‌تواند NTLM صحبت کند، که همان احراز هویت ویندوزی است اما با
       اطلاعات ورود تایپ‌شده به‌جای گرفتن از توکن ویندوزِ لاگین‌شده. احراز هویت
       یکپارچه‌ی واقعی به درایور بومی ODBC نیاز دارد؛ به یادداشت auth-modes
       نگاه کنید. */
    base.authentication = {
      type: 'ntlm',
      options: {
        userName: input.user || '',
        password: input.password || '',
        domain: input.domain || '',
      },
    };
  } else {
    base.user = input.user || '';
    base.password = input.password || '';
  }
  return base;
}

/**
 * @param {*} input همان شکل buildConfig
 * @returns {Promise<object>} Session
 */
async function openSession(input) {
  const pool = await new sql.ConnectionPool(buildConfig(input)).connect();
  const session = {
    token: crypto.randomBytes(24).toString('hex'),
    server: input.server,
    port: input.port || 1433,
    database: input.database,
    auth: input.auth,
    user: input.user || '',
    pool,
    openedAt: new Date(),
    lastUsed: new Date(),
  };
  sessions.set(session.token, session);
  return session;
}

async function closeSession(token) {
  const s = sessions.get(token);
  if (!s) return false;
  sessions.delete(token);
  try {
    await s.pool.close();
  } catch {
    /* از قبل بسته شده */
  }
  return true;
}

function getSession(token) {
  if (!token) return undefined;
  const s = sessions.get(token);
  if (s) s.lastUsed = new Date();
  return s;
}

/** نشستی که این درخواست به آن تعلق دارد، اگر middleware آن را پیدا کرده باشد. */
const currentSession = () => storage.getStore();

function runInSession(session, fn) {
  return storage.run(session, fn);
}

/** چیزی که رابط کاربری در سربرگ نشان می‌دهد؛ چیزی محرمانه در آن نیست. */
function describeSession(s) {
  return {
    token: s.token,
    server: s.server,
    port: s.port,
    database: s.database,
    auth: s.auth,
    user: s.user,
    openedAt: s.openedAt,
  };
}

const sessionCount = () => sessions.size;

setInterval(() => {
  const cutoff = Date.now() - IDLE_MS;
  for (const [token, s] of sessions) {
    if (s.lastUsed.getTime() < cutoff) {
      sessions.delete(token);
      s.pool.close().catch(() => {
        /* از قبل بسته شده */
      });
      console.log(`[session] closed idle connection to ${s.server}/${s.database}`);
    }
  }
}, 15 * 60 * 1000).unref();

module.exports = {
  buildConfig,
  openSession,
  closeSession,
  getSession,
  currentSession,
  runInSession,
  describeSession,
  sessionCount,
};
