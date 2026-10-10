// Connection smoke test used by RUN-API.ps1, so a bad password or an
// unreachable server reports one clear line instead of a console full of
// stack traces. Since the server/database used by the app is now chosen on
// the Login page, this only checks the .env fallback - a failure here is
// worth reporting but must never stop the launcher.
//
// It must never throw. tedious reports some failures by emitting an 'error'
// event on the pool rather than rejecting the connect promise, and an
// unhandled one of those crashes Node with a stack trace out of
// connection.js - exactly what a person running a .bat file should never
// have to read.
//
// Usage: node db-check.js [path-to-.env]
const fs = require('fs');
const path = require('path');
const sql = require('mssql');

/** یک خط، یک‌بار، بعد خروج. */
let reported = false;
function report(line) {
  if (reported) return;
  reported = true;
  console.log(line);
  process.exit(0);
}

process.on('uncaughtException', (err) => report('FAIL - ' + (err && err.message ? err.message : err)));
process.on('unhandledRejection', (err) => report('FAIL - ' + (err && err.message ? err.message : err)));

const envPath = process.argv[2] || path.resolve(__dirname, '.env');
if (!fs.existsSync(envPath)) report('FAIL - .env not found at ' + envPath);

const env = {};
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq > 0) env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
}

if (!env.DB_SERVER || !env.DB_DATABASE) report('FAIL - DB_SERVER or DB_DATABASE is missing from ' + envPath);

const pool = new sql.ConnectionPool({
  server: env.DB_SERVER,
  port: Number(env.DB_PORT || 1433),
  database: env.DB_DATABASE,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  options: {
    encrypt: (env.DB_ENCRYPT || 'false').toLowerCase() === 'true',
    trustServerCertificate: (env.DB_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() === 'true',
  },
  connectionTimeout: 15000,
});

// Without this listener an emitted error is fatal rather than reportable.
pool.on('error', (err) => report('FAIL - ' + (err && err.message ? err.message : err)));

// A belt-and-braces deadline: if the driver neither resolves nor errors, say
// so instead of leaving the launcher waiting.
const deadline = setTimeout(() => report('FAIL - no answer from ' + env.DB_SERVER + ' within 20s'), 20000);
deadline.unref();

pool
  .connect()
  .then(() => pool.request().query('SELECT COUNT(*) AS n FROM alm.Menu'))
  .then((result) => report('OK - ' + result.recordset[0].n + ' alm.Menu rows'))
  .catch((err) => report('FAIL - ' + (err && err.message ? err.message : err)));
