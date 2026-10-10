require('dotenv').config();

const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const {
  openSession, closeSession, getSession, currentSession, runInSession, describeSession, buildConfig,
} = require('./session');
const {
  loadConnections, rememberConnection, forgetConnection, connectionsFile,
} = require('./connections');

const app = express();

/**
 * CORS_ORIGIN می‌تواند چند آدرس با کاما جدا شده باشد — چون فرانت‌اند
 * gng-mfr-app ممکن است از چند آدرس مختلف باز شود: روی خودِ این سرور
 * (localhost)، یا از سیستم‌های دیگر شبکه با نام کامپیوتر یا IP این سرور.
 * اگر یکی از این آدرس‌ها در لیست نباشد، مرورگرِ آن کاربر با خطای CORS
 * بلاک می‌شود، پس هر آدرس جدیدی که فرانت از آن سرو می‌شود باید به همین
 * لیست در .env اضافه شود.
 *
 * توکن نشست در هدر x-alm-session سفر می‌کند، پس باید در CORS مجاز باشد —
 * هم برای ارسال از فرانت‌اند (allowedHeaders) و هم برای این‌که فرانت‌اند
 * بتواند آن را در پاسخ بخواند (exposedHeaders).
 */
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:4400')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // بدون Origin (مثلاً curl یا health-check) همیشه مجاز است
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: آدرس ${origin} در CORS_ORIGIN تعریف نشده — به .env اضافه کنید.`));
      }
    },
    exposedHeaders: ['x-alm-session'],
    allowedHeaders: ['Content-Type', 'x-alm-session'],
  })
);
app.use(express.json());

/**
 * اتصال .env قبلاً فقط SQL Authentication را می‌فهمید (یک شیء ثابت با
 * user/password مستقیم) — چون MNG_System روی 172.31.1.200 فقط با Windows
 * Authentication (NTLM) باز می‌شود، این پیش‌فرض هم باید بتواند همان مسیر
 * buildConfig را برود که session.js برای لاگین‌های واقعی استفاده می‌کند؛
 * وگرنه هر درخواستی که بدون توکن نشست می‌رسد (health-check و مشابه) با
 * «Login failed» رد می‌شد چون به‌جای NTLM سعی می‌کرد SQL Auth بزند.
 * DB_AUTH=windows در .env همین مسیر را فعال می‌کند.
 */
const dbConfig = buildConfig({
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_DATABASE,
  auth: (process.env.DB_AUTH || 'sql').toLowerCase() === 'windows' ? 'windows' : 'sql',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  domain: process.env.DB_DOMAIN || '',
  encrypt: (process.env.DB_ENCRYPT || 'false').toLowerCase() === 'true',
});
dbConfig.options.trustServerCertificate =
  (process.env.DB_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() === 'true';

let poolPromise = null;
/** اتصال .env — پشتیبان برای هر درخواستی که خارج از یک نشستِ لاگین‌شده اجرا می‌شود. */
function getEnvPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(dbConfig).connect().catch((err) => {
      poolPromise = null; // اجازه بده دفعه‌ی بعد دوباره تلاش کند
      throw err;
    });
  }
  return poolPromise;
}

/**
 * pool مخصوص همین درخواست. اگر درخواست از صفحه‌ی Login وارد شده و توکن نشست
 * معتبر دارد، pool همان نشست (همان سرور/دیتابیسی که کاربر انتخاب کرده)
 * برگردانده می‌شود — بدون این‌که endpointهای موجود (alm/menu ، alm/systems)
 * چیزی درباره‌ی نشست بدانند. بدون توکن، همان اتصال .env قبلی به‌کار می‌رود.
 */
function getPool() {
  const session = currentSession();
  if (session) return Promise.resolve(session.pool);
  return getEnvPool();
}

/** یک async route handler را طوری می‌پیچد که reject شدن promise به پاسخ 500
 *  تبدیل شود، نه یک unhandled rejection که کل پردازه را می‌ترکاند. */
function ah(fn) {
  return (req, res, next) => {
    fn(req, res).catch((err) => {
      console.error(`[${req.method} ${req.path}]`, err.message || err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || 'internal error' });
      }
    });
  };
}

/* ---------------------------------------------------------------- نشست‌ها --
 * هر درخواستی که توکن معتبر داشته باشد داخل همان نشست اجرا می‌شود، که همان
 * چیزی است که getPool() را وادار می‌کند pool درست را برگرداند. درخواست بدون
 * توکن هم‌چنان کار می‌کند و به اتصال .env برمی‌گردد — یعنی health-check و
 * endpointهای موجود بدون تغییر کار می‌کنند.
 */
const OPEN_PATHS = new Set(['/api/connect', '/api/health', '/api/auth-modes', '/api/connections']);

app.use('/api', (req, res, next) => {
  if (OPEN_PATHS.has(req.baseUrl + req.path) || OPEN_PATHS.has(req.path)) return next();
  const token = req.header('x-alm-session') || undefined;
  if (!token) return next();
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: 'نشست منقضی شده؛ دوباره وارد شوید', code: 'no-session' });
  return runInSession(session, () => next());
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'gng-mfr-api' });
});

/** دو حالت احراز هویت این بک‌اند: SQL Server Authentication و Windows
 *  Authentication با NTLM. احراز هویت یکپارچه‌ی واقعی (بدون رمز) به درایور
 *  بومی msnodesqlv8 نیاز دارد که روی Node 24 بارگذاری نمی‌شود؛ همین‌جا
 *  گزارش می‌شود تا صفحه‌ی Login بداند چه چیزی واقعاً در دسترس است. */
app.get('/api/auth-modes', (_req, res) => {
  let integrated = false;
  try {
    require('msnodesqlv8');
    integrated = true;
  } catch {
    integrated = false;
  }
  res.json({
    modes: [
      { code: 'sql', title: 'SQL Server Authentication', needsPassword: true },
      { code: 'windows', title: 'Windows Authentication (NTLM)', needsPassword: true, needsDomain: true },
    ],
    integratedAvailable: integrated,
    note: integrated
      ? null
      : 'احراز هویت یکپارچه‌ی ویندوز (بدون رمز) به درایور بومی نیاز دارد که روی این نسخه‌ی Node بارگذاری نمی‌شود؛ حالت ویندوزی با NTLM کار می‌کند و نام کاربری، دامنه و رمز می‌خواهد.',
  });
});

/** دیتابیس‌هایی که این نصب قبلاً باز کرده. هیچ رمزی نگه‌داری نمی‌شود. */
app.get('/api/connections', (_req, res) => {
  res.json({ file: connectionsFile(), connections: loadConnections() });
});

app.delete('/api/connections/:id', (req, res) => {
  res.json({ ok: true, connections: forgetConnection(req.params.id) });
});

/** یک اتصال باز می‌کند و توکنی برمی‌گرداند که هر درخواست بعدی حمل می‌کند. */
app.post(
  '/api/connect',
  ah(async (req, res) => {
    const b = req.body || {};
    const server = String(b.server || '').trim();
    const database = String(b.database || '').trim();
    const auth = b.auth === 'windows' ? 'windows' : 'sql';
    if (!server || !database) return res.status(400).json({ error: 'نام سرور و نام دیتابیس لازم است' });

    try {
      const session = await openSession({
        server,
        port: Number(b.port) || 1433,
        database,
        auth,
        user: String(b.user || '').trim(),
        password: String(b.password || ''),
        domain: String(b.domain || '').trim(),
        encrypt: b.encrypt === true,
      });
      // کار کرد، پس دفعه‌ی بعد ارزش پیشنهاد دادن دارد — فقط آدرس‌ها.
      rememberConnection({
        server: session.server,
        port: session.port,
        database: session.database,
        auth: session.auth,
        user: session.user,
        domain: String(b.domain || '').trim(),
      });
      console.log(`[session] opened ${session.server}/${session.database} as ${session.user || '(windows)'}`);
      res.json(describeSession(session));
    } catch (err) {
      // این‌جا لاگ می‌کنیم چون پیام خطای واقعیِ درایور برای عیب‌یابی لازم
      // است؛ قبلاً فقط به فرانت‌اند برمی‌گشت و در کنسول این پردازه دیده
      // نمی‌شد.
      console.error(
        `[connect] FAILED server=${server} database=${database} auth=${auth} user=${String(b.user || '').trim()} code=${err.code || '-'} -> ${err.message || err}`
      );
      // پیام خودِ درایور همان چیزی است که برای یک کاربر فنی مفید است.
      res.status(400).json({ error: err.message || 'اتصال برقرار نشد' });
    }
  })
);

/** به کدام سرور/دیتابیس وصلم؟ */
app.get('/api/session', (req, res) => {
  const session = getSession(req.header('x-alm-session') || undefined);
  if (!session) return res.status(401).json({ error: 'نشستی باز نیست', code: 'no-session' });
  res.json(describeSession(session));
});

app.delete(
  '/api/session',
  ah(async (req, res) => {
    const closed = await closeSession(req.header('x-alm-session') || '');
    res.json({ ok: true, closed });
  })
);

/**
 * منوی درختی یک «سیستم» (مدیریت تولید، برنامه‌ریزی تولید، بهای تمام‌شده،
 * ...) — مستقیماً از alm.Menu می‌خواند. سیستم با SubSystemCode مشخص
 * می‌شود که از فرانت‌اند به‌صورت query param (?subSystemCode=...) می‌آید
 * (به پیکر انتخاب سیستم در نوار برند سایدبار نگاه کنید — آن پیکر از
 * GET /api/alm/systems پر می‌شود). اگر ارسال نشود، برای سازگاری با
 * نسخه‌های قبل، پیش‌فرض «mes» (مدیریت تولید) است.
 *
 * نکته‌ی مهم (کشف‌شده در بررسی داده‌ی واقعی، فاز قبل اشتباه فرض شده بود):
 * SubSystemCode در alm.Menu کد منطقیِ زیرسیستم در محیط طراحی ALM است
 * («mes» = «مدیریت تولید»، طبق alm.SystemDev)، نه نام اسکیمای فیزیکی SQL.
 * اسکیمای داده‌ی این سیستم همچنان mfr/generalmfr است (طبق قانون پروژه)؛
 * SubSystemCode فقط برای فیلتر کردن ساختار منو در alm استفاده می‌شود —
 * وقتی سیستم‌های دیگر (برنامه‌ریزی تولید، بهای تمام‌شده، ...) به
 * alm.Menu اضافه شوند، هرکدام SubSystemCode منطقی خودشان را می‌گیرند.
 *
 * MenuLevel > 0 چون سطر MenuLevel=0 خودِ ریشه‌ی سیستم («۴ - مدیریت تولید»)
 * است، نه یک آیتم منو — آن سطر جدا از GET /api/alm/systems می‌آید.
 *
 * ستون‌ها عیناً با مدل AlmMenuRow سمت فرانت‌اند
 * (src/app/core/models/menu-item.model.ts) یکی هستند تا نگاشت اضافه لازم
 * نباشد.
 */
const ALM_MENU_SUBSYSTEM_DEFAULT = 'mes';

app.get('/api/alm/menu', async (req, res) => {
  const subSystemCode = req.query.subSystemCode || ALM_MENU_SUBSYSTEM_DEFAULT;
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('subSystemCode', sql.NVarChar, subSystemCode).query(`
      SELECT
        Code            AS code,
        Title           AS title,
        ParentCode      AS parentCode,
        SubSystemCode   AS subSystemCode,
        MenuLevel       AS menuLevel,
        FormTypeCode    AS formTypeCode,
        FormCode        AS formCode,
        SortOrder       AS sortOrder
      FROM alm.Menu
      WHERE SubSystemCode = @subSystemCode
        AND MenuLevel > 0
      ORDER BY MenuLevel, SortOrder
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('[gng-mfr-api] alm.Menu query failed:', err.message);
    res.status(500).json({ error: 'DB_QUERY_FAILED', message: err.message });
  }
});

/**
 * فهرست «سیستم‌ها» — ردیف‌های سطح صفر (MenuLevel = 0) روی کل alm.Menu، بدون
 * فیلتر SubSystemCode (برخلاف /api/alm/menu). هر ردیف یک سیستم
 * انتخاب‌پذیر در پیکر بالای منوی کناری است (مثلاً مدیریت تولید، و هر
 * سیستم دیگری که بعداً به alm.Menu اضافه شود — بدون نیاز به تغییر این
 * کد). SubSystemCode هر ردیف همان مقداری است که باید به
 * GET /api/alm/menu?subSystemCode=... پاس داده شود.
 */
app.get('/api/alm/systems', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        Code          AS code,
        Title         AS title,
        SubSystemCode AS subSystemCode,
        SortOrder     AS sortOrder
      FROM alm.Menu
      WHERE MenuLevel = 0
      ORDER BY SortOrder
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('[gng-mfr-api] alm systems query failed:', err.message);
    res.status(500).json({ error: 'DB_QUERY_FAILED', message: err.message });
  }
});

/**
 * «بررسی دیتابیس» — ابزار توسعه: مقایسه‌ی جدول‌های دو دسته اسکیما (مثلاً mes در
 * برابر mfr و generalmfr). این دو اندپوینت فقط فراداده‌ی ساختار را از sys.* می‌خوانند
 * و هیچ داده‌ای از جدول‌ها برنمی‌گردانند.
 *
 *   GET /api/db-compare/schemas            فهرست اسکیماهایی که جدول دارند
 *   GET /api/db-compare/tables?schemas=a,b جدول‌ها و ستون‌های آن اسکیماها
 *
 * نام اسکیماها با پارامتر به SQL می‌رود (STRING_SPLIT)، نه با رشته‌چینی.
 */
app.get(
  '/api/db-compare/schemas',
  ah(async (_req, res) => {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT s.name AS name, COUNT(*) AS tableCount
      FROM sys.tables t
      JOIN sys.schemas s ON s.schema_id = t.schema_id
      WHERE t.is_ms_shipped = 0
      GROUP BY s.name
      ORDER BY s.name
    `);
    res.json(r.recordset);
  })
);

function sqlTypeText(c) {
  const t = c.typeName;
  if (['nvarchar', 'nchar'].includes(t)) return `${t}(${c.maxLength === -1 ? 'max' : c.maxLength / 2})`;
  if (['varchar', 'char', 'varbinary', 'binary'].includes(t)) return `${t}(${c.maxLength === -1 ? 'max' : c.maxLength})`;
  if (['decimal', 'numeric'].includes(t)) return `${t}(${c.precision},${c.scale})`;
  if (['datetime2', 'time', 'datetimeoffset'].includes(t)) return `${t}(${c.scale})`;
  return t;
}

app.get(
  '/api/db-compare/tables',
  ah(async (req, res) => {
    const schemas = String(req.query.schemas || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 20);
    if (!schemas.length) return res.status(400).json({ error: 'دست‌کم یک اسکیما لازم است' });

    const pool = await getPool();
    const r = await pool.request().input('schemas', sql.NVarChar, schemas.join(',')).query(`
      SELECT s.name AS schemaName, t.name AS tableName, c.name AS columnName, c.column_id AS ordinal,
             ty.name AS typeName, c.max_length AS maxLength, c.precision AS [precision], c.scale AS scale,
             c.is_nullable AS isNullable, c.is_identity AS isIdentity, c.is_computed AS isComputed
      FROM sys.tables t
      JOIN sys.schemas s ON s.schema_id = t.schema_id
      JOIN sys.columns c ON c.object_id = t.object_id
      JOIN sys.types ty ON ty.user_type_id = c.user_type_id
      WHERE t.is_ms_shipped = 0
        AND s.name IN (SELECT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@schemas, ','))
      ORDER BY s.name, t.name, c.column_id
    `);

    const tables = new Map();
    for (const c of r.recordset) {
      const key = `${c.schemaName}.${c.tableName}`;
      if (!tables.has(key)) tables.set(key, { schema: c.schemaName, table: c.tableName, columns: [] });
      tables.get(key).columns.push({
        name: c.columnName,
        type: sqlTypeText(c),
        nullable: !!c.isNullable,
        identity: !!c.isIdentity,
        computed: !!c.isComputed,
      });
    }
    res.json([...tables.values()]);
  })
);

/**
 * خلاصه‌ی پوشش فیچر یک فرم — برای نشان کوچک کنار «کد فرم» بالای هر فرم:
 *   total     تعداد فیچرهایی که فرم باید پوشش دهد (alm.FormFeatureMapping)
 *   implemented فیچرهایی که در فرم پیاده شده‌اند (وضعیت «در حال کار» یا «تحویل شده»)
 *   delivered فیچرهای تحویل‌شده
 */
app.get('/api/alm/forms/:formCode/coverage', async (req, res) => {
  const formCode = String(req.params.formCode || '').trim();
  try {
    const pool = await getPool();
    const r = await pool.request().input('formCode', sql.NVarChar, formCode).query(`
      SELECT COUNT(*) AS total,
             ISNULL(SUM(CASE WHEN DevStatusCode IN ('InProgress', 'Delivered') THEN 1 ELSE 0 END), 0) AS implemented,
             ISNULL(SUM(CASE WHEN DevStatusCode = 'Delivered' THEN 1 ELSE 0 END), 0) AS delivered
      FROM alm.FormFeatureMapping
      WHERE FormCode = @formCode
    `);
    res.json(r.recordset[0]);
  } catch (err) {
    console.error('[gng-mfr-api] alm form coverage query failed:', err.message);
    res.status(500).json({ error: 'DB_QUERY_FAILED', message: err.message });
  }
});

/**
 * شناسنامه‌ی یک فرم در ALM — با کلیک روی «کد فرم» بالای هر فرم در تب جدا
 * باز می‌شود (صفحه‌ی /alm/forms/:formCode در فرانت‌اند). چهار بخش:
 *   form     مشخصات فرم (alm.Form + عنوان نوع/فاز/زیرسیستم/سند تحلیل)
 *   features فیچرهایی که این فرم پوشش می‌دهد یا باید بدهد
 *            (alm.FormFeatureMapping ⨝ alm.Feature). وضعیت توسعه از
 *            DevStatusCode می‌آید؛ NULL یعنی هنوز شروع نشده.
 *   access   ماتریس دسترسی (alm.FormAccess)
 *   actions  عملیات‌های فرم (alm.FormAction ⨝ alm.ActionType)
 */
app.get('/api/alm/forms/:formCode', async (req, res) => {
  const formCode = String(req.params.formCode || '').trim();
  try {
    const pool = await getPool();
    const q = (text) => pool.request().input('formCode', sql.NVarChar, formCode).query(text);

    const form = await q(`
      SELECT
        f.Code                  AS code,
        f.Title                 AS title,
        f.SubSystemCode         AS subSystemCode,
        sd.Title                AS subSystemTitle,
        f.AnalysisDocumentCode  AS analysisDocumentCode,
        ad.Title                AS analysisDocumentTitle,
        f.FormTypeCode          AS formTypeCode,
        ft.Title                AS formTypeTitle,
        f.PhaseCode             AS phaseCode,
        fp.Title                AS phaseTitle,
        f.PrimaryAccessGroupCode AS primaryAccessGroupCode,
        f.OtherAccessGroupsText AS otherAccessGroupsText,
        f.TabsDescription       AS tabsDescription,
        f.TabCount              AS tabCount,
        f.ActionCount           AS actionCount,
        f.FeatureCount          AS featureCount,
        f.EstimateFromFeatures  AS estimateFromFeatures,
        f.OverheadEstimate      AS overheadEstimate,
        f.TotalEstimate         AS totalEstimate,
        f.DesignOwner           AS designOwner,
        f.Note                  AS note
      FROM alm.Form f
      LEFT JOIN alm.FormType  ft ON ft.Code = f.FormTypeCode
      LEFT JOIN alm.FormPhase fp ON fp.Code = f.PhaseCode
      LEFT JOIN alm.AnalysisDocument ad ON ad.Code = f.AnalysisDocumentCode
      OUTER APPLY (
        SELECT TOP 1 s.Title FROM alm.SystemDev s
        WHERE s.SubSystemCode = f.SubSystemCode
        ORDER BY s.LevelNo, s.SortOrder
      ) sd
      WHERE f.Code = @formCode
    `);
    if (!form.recordset.length) {
      return res.status(404).json({ error: 'FORM_NOT_FOUND', message: `فرم ${formCode} در alm.Form نیست.` });
    }

    const features = await q(`
      SELECT
        m.Code                  AS mappingCode,
        m.FeatureCode           AS featureCode,
        ft.Requirement          AS requirement,
        ft.Title                AS title,
        ft.ExtraInfo            AS extraInfo,
        ft.Module               AS module,
        ft.ArtifactTypeCode     AS artifactTypeCode,
        at.Title                AS artifactTypeTitle,
        ft.FeaturePriorityCode  AS priorityCode,
        pr.Title                AS priorityTitle,
        ft.DevelopmentPhaseCode AS phaseCode,
        ph.Title                AS phaseTitle,
        ft.FeatureComplexityCode AS complexityCode,
        cx.Title                AS complexityTitle,
        ip.Title                AS industryTitle,
        ft.EstimatedEffortDays  AS effortDays,
        m.DevStatusCode         AS devStatusCode,
        ds.Title                AS devStatusTitle,
        ds.ColorHex             AS devStatusColor,
        m.Note                  AS note
      FROM alm.FormFeatureMapping m
      LEFT JOIN alm.Feature           ft ON ft.Code = m.FeatureCode
      LEFT JOIN alm.ArtifactType      at ON at.Code = ft.ArtifactTypeCode
      LEFT JOIN alm.FeaturePriority   pr ON pr.Code = ft.FeaturePriorityCode
      LEFT JOIN alm.DevelopmentPhase  ph ON ph.Code = ft.DevelopmentPhaseCode
      LEFT JOIN alm.FeatureComplexity cx ON cx.Code = ft.FeatureComplexityCode
      LEFT JOIN alm.IndustryProfile   ip ON ip.Code = ft.IndustryProfileCode
      LEFT JOIN alm.DevStatus         ds ON ds.Code = m.DevStatusCode
      WHERE m.FormCode = @formCode
      ORDER BY m.SortOrder, m.Code
    `);

    const access = await q(`
      SELECT
        Code          AS code,
        UserGroupCode AS userGroupCode,
        AllowRetrive  AS allowRetrieve,
        AllowCreate   AS allowCreate,
        AllowModify   AS allowModify,
        AllowRemove   AS allowRemove,
        AllowExecute  AS allowExecute,
        Note          AS note
      FROM alm.FormAccess
      WHERE FormCode = @formCode
      ORDER BY SortOrder, Code
    `);

    const actions = await q(`
      SELECT
        a.Code               AS code,
        a.Title              AS title,
        a.RequiredPermission AS requiredPermission,
        a.ActionTypeCode     AS actionTypeCode,
        t.Title              AS actionTypeTitle,
        a.Note               AS note
      FROM alm.FormAction a
      LEFT JOIN alm.ActionType t ON t.Code = a.ActionTypeCode
      WHERE a.FormCode = @formCode
      ORDER BY a.SortOrder, a.Code
    `);

    res.json({
      form: form.recordset[0],
      features: features.recordset,
      access: access.recordset,
      actions: actions.recordset,
    });
  } catch (err) {
    console.error('[gng-mfr-api] alm form spec query failed:', err.message);
    res.status(500).json({ error: 'DB_QUERY_FAILED', message: err.message });
  }
});

/**
 * اندپوینت موقتِ عیب‌یابی: تعداد جدول‌های اسکیمای mfr و generalmfr روی
 * دیتابیسی که همین الان پشت این پروسه وصل است (نشستِ لاگین‌شده یا پیش‌فرض
 * .env). چون از اینجا (محیط ابری) مستقیماً نمی‌توانم به شبکه‌ی داخلی کاربر
 * وصل شوم، این مسیر با مرورگر روی خودِ سیستم کاربر باز می‌شود و جواب JSON
 * مستقیماً خوانده می‌شود — راه‌حل سریع‌تر از منتظرماندن برای بالاآمدن
 * mssql-MNG. بعد از این‌که آن سرور MCP محلی فعال شد، این اندپوینت دیگر لازم
 * نیست و می‌تواند حذف شود.
 */
app.get('/api/debug/schema-counts', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT s.name AS schemaName, COUNT(*) AS tableCount
      FROM sys.tables t
      JOIN sys.schemas s ON s.schema_id = t.schema_id
      WHERE s.name IN ('mfr', 'generalmfr')
      GROUP BY s.name
    `);
    const dbRow = await pool.request().query('SELECT DB_NAME() AS dbName, @@SERVERNAME AS serverName');
    res.json({ server: dbRow.recordset[0], counts: result.recordset });
  } catch (err) {
    console.error('[gng-mfr-api] schema-counts query failed:', err.message);
    res.status(500).json({ error: 'DB_QUERY_FAILED', message: err.message });
  }
});

/**
 * FRM-RM-01 — «ساختار کارخانه و خطوط تولید» — اولین فرم واقعی (غیر Mock) در
 * GNG+، روی دیتابیس Pilot (MNG_System). همه‌ی این مسیرها فقط خواندنی‌اند و
 * از SP های تازه زیر اسکیمای mes می‌خوانند (قرارداد نام‌گذاری GNG+ — به سند
 * حاکمیت نگاه کنید). ساختن جدول‌ها/SP ها و داده‌ی آزمایشی (CompanyId=222)
 * با scripts/mes_frm_rm01_setup.sql است — این فایل فقط آن SP ها را صدا می‌زند.
 */
app.get(
  '/api/rm01/org-tree',
  ah(async (req, res) => {
    const companyId = parseInt(req.query.companyId, 10) || 222;
    const pool = await getPool();
    const result = await pool.request().input('CompanyId', sql.Int, companyId).execute('mes.GetOrgTree');
    res.json(result.recordset);
  })
);

app.get(
  '/api/rm01/lines',
  ah(async (req, res) => {
    const companyId = parseInt(req.query.companyId, 10) || 222;
    const pool = await getPool();
    const result = await pool.request().input('CompanyId', sql.Int, companyId).execute('mes.GetProductionLines');
    res.json(result.recordset);
  })
);

app.get(
  '/api/rm01/lines/:lineId/ancestry',
  ah(async (req, res) => {
    const lineId = parseInt(req.params.lineId, 10);
    const pool = await getPool();
    const result = await pool.request().input('LineId', sql.Int, lineId).execute('mes.GetLineAncestry');
    res.json(result.recordset);
  })
);

app.get(
  '/api/rm01/lines/:lineId/topology',
  ah(async (req, res) => {
    const lineId = parseInt(req.params.lineId, 10);
    const pool = await getPool();
    const result = await pool.request().input('LineId', sql.Int, lineId).execute('mes.GetStationsUnderNode');
    res.json(result.recordset);
  })
);

app.get(
  '/api/rm01/resource-groups',
  ah(async (req, res) => {
    const companyId = parseInt(req.query.companyId, 10) || 222;
    const pool = await getPool();
    const result = await pool.request().input('CompanyId', sql.Int, companyId).execute('mes.GetResourceGroups');
    res.json(result.recordset);
  })
);

app.get(
  '/api/rm01/mobile-resources',
  ah(async (req, res) => {
    const companyId = parseInt(req.query.companyId, 10) || 222;
    const pool = await getPool();
    const result = await pool.request().input('CompanyId', sql.Int, companyId).execute('mes.GetMobileResources');
    res.json(result.recordset);
  })
);

app.get(
  '/api/rm01/line-side-warehouses',
  ah(async (req, res) => {
    const companyId = parseInt(req.query.companyId, 10) || 222;
    const pool = await getPool();
    const result = await pool.request().input('CompanyId', sql.Int, companyId).execute('mes.GetLineSideWarehouses');
    res.json(result.recordset);
  })
);

/**
 * FRM-RM-01 — دامنه‌ی انتخاب درخت سازمانی.
 *
 * درخت «سلسله‌مراتب سازمانی و مکانی» انتخابگر مشترک کل فرم است: با انتخاب یک
 * گره‌ی سازمانی (orgNodeId) همه‌ی خطوط زیر آن در هر عمقی، و با انتخاب یک خط
 * (lineId) فقط همان خط برمی‌گردد.
 *
 * توپولوژی عمداً به شکل «گراف» (nodes + edges) برمی‌گردد، نه فهرست مرتب:
 * اتصال‌ها از mes.WorkCenterLink می‌آیند، پس انشعاب، ادغام و مسیر برگشت
 * (دوباره‌کاری) قابل بیان است. همین شکل بعداً بدون تغییر قرارداد، مختصات
 * مکانی (نقشه‌ی کارخانه) را هم می‌پذیرد — کافی است به هر node فیلدهای
 * x/y اضافه شود.
 */
function scopeParams(req) {
  const orgNodeId = parseInt(req.query.orgNodeId, 10);
  const lineId = parseInt(req.query.lineId, 10);
  const stationId = parseInt(req.query.stationId, 10);
  return {
    orgNodeId: Number.isInteger(orgNodeId) ? orgNodeId : null,
    lineId: Number.isInteger(lineId) ? lineId : null,
    stationId: Number.isInteger(stationId) ? stationId : null,
  };
}

app.get(
  '/api/rm01/topology',
  ah(async (req, res) => {
    const { orgNodeId, lineId } = scopeParams(req);
    if (orgNodeId === null && lineId === null) {
      return res.status(400).json({ error: 'یکی از orgNodeId یا lineId لازم است' });
    }
    const pool = await getPool();
    const run = (proc) =>
      pool.request().input('OrgNodeId', sql.Int, orgNodeId).input('LineId', sql.Int, lineId).execute(proc);

    const [lines, stations, links] = await Promise.all([
      run('mes.GetLinesUnderNode'),
      run('mes.GetStationsUnderNode'),
      run('mes.GetStationLinksUnderNode'),
    ]);

    const byLine = new Map(lines.recordset.map((l) => [l.LineId, { ...l, nodes: [], edges: [] }]));
    for (const s of stations.recordset) byLine.get(s.LineId)?.nodes.push(s);
    for (const k of links.recordset) byLine.get(k.LineId)?.edges.push(k);

    res.json({ lines: [...byLine.values()] });
  })
);

app.get(
  '/api/rm01/org-nodes/:orgNodeId/ancestry',
  ah(async (req, res) => {
    const orgNodeId = parseInt(req.params.orgNodeId, 10);
    const pool = await getPool();
    const result = await pool.request().input('OrgNodeId', sql.Int, orgNodeId).execute('mes.GetNodeAncestry');
    res.json(result.recordset);
  })
);

/**
 * FRM-RM-02 — «تجهیزات، ابزار و قالب».
 *
 * همان دامنه‌ی انتخاب درخت سازمانی FRM-RM-01، این‌بار تا سطح ایستگاه:
 * orgNodeId (گره و همه‌ی زیرگره‌ها) یا lineId یا lineId+stationId. همه‌ی تب‌های
 * فرم با یک درخواست پر می‌شوند تا با هر کلیک روی درخت فقط یک رفت‌وبرگشت باشد.
 * جدول‌ها/SP ها و داده‌ی نمونه با scripts/mes_frm_rm02_setup.sql ساخته می‌شوند.
 */
app.get(
  '/api/rm02/bundle',
  ah(async (req, res) => {
    const { orgNodeId, lineId, stationId } = scopeParams(req);
    if (orgNodeId === null && lineId === null && stationId === null) {
      return res.status(400).json({ error: 'یکی از orgNodeId، lineId یا stationId لازم است' });
    }
    const pool = await getPool();
    const run = (proc) =>
      pool
        .request()
        .input('OrgNodeId', sql.Int, orgNodeId)
        .input('LineId', sql.Int, lineId)
        .input('StationId', sql.Int, stationId)
        .execute(proc)
        .then((r) => r.recordset);

    const [equipment, attributes, capabilities, tools, changeover, software] = await Promise.all([
      run('mes.GetEquipmentInScope'),
      run('mes.GetEquipmentAttributesInScope'),
      run('mes.GetEquipmentCapabilitiesInScope'),
      run('mes.GetToolsInScope'),
      run('mes.GetChangeoverInScope'),
      run('mes.GetEquipmentSoftwareInScope'),
    ]);
    res.json({ equipment, attributes, capabilities, tools, changeover, software });
  })
);

/**
 * FRM-RM-03 — «نیروی کار و ماتریس مهارت».
 *
 * همان دامنه‌ی انتخاب درخت سازمانی (گره، خط یا ایستگاه). همه‌ی تب‌ها با یک
 * درخواست پر می‌شوند. جدول‌ها/SP ها و داده‌ی نمونه با
 * scripts/mes_frm_rm03_setup.sql ساخته می‌شوند.
 */
app.get(
  '/api/rm03/bundle',
  ah(async (req, res) => {
    const { orgNodeId, lineId, stationId } = scopeParams(req);
    if (orgNodeId === null && lineId === null && stationId === null) {
      return res.status(400).json({ error: 'یکی از orgNodeId، lineId یا stationId لازم است' });
    }
    const pool = await getPool();
    const run = (proc) =>
      pool
        .request()
        .input('OrgNodeId', sql.Int, orgNodeId)
        .input('LineId', sql.Int, lineId)
        .input('StationId', sql.Int, stationId)
        .execute(proc)
        .then((r) => r.recordset);

    const [personnel, skills, personnelSkills, requirements, workingGroups, stationAssignments] = await Promise.all([
      run('mes.GetPersonnelInScope'),
      run('mes.GetSkillsInScope'),
      run('mes.GetPersonnelSkillsInScope'),
      run('mes.GetOperationSkillRequirementsInScope'),
      run('mes.GetWorkingGroupsInScope'),
      run('mes.GetPersonnelStationsInScope'),
    ]);
    res.json({ personnel, skills, personnelSkills, requirements, workingGroups, stationAssignments });
  })
);

/**
 * FRM-RM-04 — «شیفت و برنامه‌ی حضور».
 *
 * الگوی شیفت و چرخه‌ها مشترک‌اند؛ تخصیص چرخه، برنامه‌ی حضور و غیبت‌ها به
 * گروه‌های کاریِ دامنه‌ی انتخاب محدود می‌شوند. برنامه‌ی حضور یک پنجره‌ی
 * زمانی دارد: from (YYYY-MM-DD، پیش‌فرض امروزِ سرور) و days (پیش‌فرض ۱۴).
 * جدول‌ها/SP ها و داده‌ی نمونه با scripts/mes_frm_rm04_setup.sql ساخته می‌شوند.
 */
app.get(
  '/api/rm04/bundle',
  ah(async (req, res) => {
    const { orgNodeId, lineId, stationId } = scopeParams(req);
    if (orgNodeId === null && lineId === null && stationId === null) {
      return res.status(400).json({ error: 'یکی از orgNodeId، lineId یا stationId لازم است' });
    }
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const from = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.from || '')) ? String(req.query.from) : today;
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 14, 1), 62);
    const fromDate = new Date(`${from}T00:00:00Z`);
    if (Number.isNaN(fromDate.getTime())) return res.status(400).json({ error: 'تاریخ from نامعتبر است' });

    const pool = await getPool();
    const plain = (proc) => pool.request().execute(proc).then((r) => r.recordset);
    const scoped = (proc, windowed) => {
      const r = pool
        .request()
        .input('OrgNodeId', sql.Int, orgNodeId)
        .input('LineId', sql.Int, lineId)
        .input('StationId', sql.Int, stationId);
      if (windowed) r.input('FromDate', sql.Date, fromDate).input('Days', sql.Int, days);
      return r.execute(proc).then((x) => x.recordset);
    };

    const [shifts, breaks, rotationDays, assignments, roster, absences] = await Promise.all([
      plain('mes.GetWorkingShifts'),
      plain('mes.GetWorkingShiftBreaks'),
      plain('mes.GetShiftRotationDays'),
      scoped('mes.GetShiftRotationAssignmentsInScope', false),
      scoped('mes.GetShiftRosterInScope', true),
      scoped('mes.GetAbsencesInScope', true),
    ]);
    res.json({ from, days, today, shifts, breaks, rotationDays, assignments, roster, absences });
  })
);

/**
 * پنجره‌ی زمانی مشترک فرم‌های تقویمی: from (YYYY-MM-DD، پیش‌فرض امروزِ سرور) و
 * days (پیش‌فرض ۱۴، حداکثر ۶۲). null یعنی from نامعتبر است.
 */
function windowParams(req) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.from || '')) ? String(req.query.from) : today;
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 14, 1), 62);
  const fromDate = new Date(`${from}T00:00:00Z`);
  if (Number.isNaN(fromDate.getTime())) return null;
  return { today, from, days, fromDate };
}

/** اجرای یک SP با دامنه‌ی انتخاب و، اگر windowed باشد، پنجره‌ی زمانی. */
function runScoped(pool, proc, scope, win) {
  const r = pool
    .request()
    .input('OrgNodeId', sql.Int, scope.orgNodeId)
    .input('LineId', sql.Int, scope.lineId)
    .input('StationId', sql.Int, scope.stationId);
  if (win) r.input('FromDate', sql.Date, win.fromDate).input('Days', sql.Int, win.days);
  return r.execute(proc).then((x) => x.recordset);
}

/**
 * FRM-RM-05 — «تقویم تولید».
 *
 * تعریف‌های تقویم مشترک‌اند؛ ارث‌بری، تقویم مؤثر، استثناها و رزرو نت به خطوطِ
 * دامنه‌ی انتخاب محدود می‌شوند. تقویم مؤثر در سطح «خط × روز» است؛ با انتخاب
 * ایستگاه، خطِ همان ایستگاه نمایش داده می‌شود.
 * جدول‌ها/SP ها و داده‌ی نمونه با scripts/mes_frm_rm05_setup.sql ساخته می‌شوند.
 */
app.get(
  '/api/rm05/bundle',
  ah(async (req, res) => {
    const scope = scopeParams(req);
    if (scope.orgNodeId === null && scope.lineId === null && scope.stationId === null) {
      return res.status(400).json({ error: 'یکی از orgNodeId، lineId یا stationId لازم است' });
    }
    const win = windowParams(req);
    if (!win) return res.status(400).json({ error: 'تاریخ from نامعتبر است' });

    const pool = await getPool();
    const [rules, inheritance, effective, exceptions, shutdowns] = await Promise.all([
      pool.request().execute('mes.GetCalendarRules').then((r) => r.recordset),
      runScoped(pool, 'mes.GetCalendarInheritanceInScope', scope, null),
      runScoped(pool, 'mes.GetEffectiveCalendarInScope', scope, win),
      runScoped(pool, 'mes.GetCalendarExceptionsInScope', scope, win),
      runScoped(pool, 'mes.GetShutdownsInScope', scope, win),
    ]);
    res.json({ from: win.from, days: win.days, today: win.today, rules, inheritance, effective, exceptions, shutdowns });
  })
);

/**
 * سرویس «تقویم مؤثر» برای برنامه‌ریزی تولید (F-RM-033): PP تقویم مستقل ندارد و
 * فقط مصرف‌کننده‌ی همین خروجی است. همان SP فرم FRM-RM-05.
 *   GET /api/pp/effective-calendar?lineId=|orgNodeId=&from=YYYY-MM-DD&days=N
 * خروجی: یک ردیف به‌ازای هر «خط × روز» با دقیقه‌ی پایه، شیفت، استثنا، نت و در دسترس.
 */
app.get(
  '/api/pp/effective-calendar',
  ah(async (req, res) => {
    const scope = scopeParams(req);
    if (scope.orgNodeId === null && scope.lineId === null) {
      return res.status(400).json({ error: 'یکی از orgNodeId یا lineId لازم است' });
    }
    const win = windowParams(req);
    if (!win) return res.status(400).json({ error: 'تاریخ from نامعتبر است' });
    const pool = await getPool();
    const rows = await runScoped(pool, 'mes.GetEffectiveCalendarInScope', scope, win);
    res.json({ from: win.from, days: win.days, rows });
  })
);

/**
 * FRM-RM-06 — «کارکرد استاندارد و ظرفیت».
 *
 * انواع کارکرد مشترک‌اند؛ ظرفیت، نرخ محصول، سابقه و نمای بار به منابعِ دامنه‌ی
 * انتخاب محدود می‌شوند (ایستگاه‌ها و گروه‌های منبعی که عضوی در دامنه دارند).
 * ظرفیت «جاری» نسبت به ابتدای پنجره سنجیده می‌شود؛ نمای بار روی همان پنجره و
 * روی تقویم مؤثر FRM-RM-05 حساب می‌شود.
 * جدول‌ها/SP ها و داده‌ی نمونه با scripts/mes_frm_rm06_setup.sql ساخته می‌شوند.
 */
app.get(
  '/api/rm06/bundle',
  ah(async (req, res) => {
    const scope = scopeParams(req);
    if (scope.orgNodeId === null && scope.lineId === null && scope.stationId === null) {
      return res.status(400).json({ error: 'یکی از orgNodeId، lineId یا stationId لازم است' });
    }
    const win = windowParams(req);
    if (!win) return res.status(400).json({ error: 'تاریخ from نامعتبر است' });

    const pool = await getPool();
    const asOf = (proc) =>
      pool
        .request()
        .input('OrgNodeId', sql.Int, scope.orgNodeId)
        .input('LineId', sql.Int, scope.lineId)
        .input('StationId', sql.Int, scope.stationId)
        .input('AsOfDate', sql.Date, win.fromDate)
        .execute(proc)
        .then((r) => r.recordset);

    const [types, capacities, productRates, load, history] = await Promise.all([
      pool.request().execute('mes.GetCapacityTypes').then((r) => r.recordset),
      asOf('mes.GetCapacitiesInScope'),
      asOf('mes.GetProductRatesInScope'),
      runScoped(pool, 'mes.GetCapacityLoadInScope', scope, win),
      runScoped(pool, 'mes.GetCapacityHistoryInScope', scope, null),
    ]);
    res.json({ from: win.from, days: win.days, today: win.today, types, capacities, productRates, load, history });
  })
);

/**
 * FRM-RM-07 — «طبقه‌بندی علل».
 *
 * درخت علل (توقف، ضایعات، دوباره‌کاری، انحراف) و نگاشت شش زیان OEE مشترک‌اند؛
 * قواعد محدودسازی و فهرست علل مجاز هر ایستگاه به دامنه‌ی انتخاب محدود می‌شوند.
 * جدول‌ها/SP ها و داده‌ی نمونه با scripts/mes_frm_rm07_setup.sql ساخته می‌شوند.
 */
app.get(
  '/api/rm07/bundle',
  ah(async (req, res) => {
    const scope = scopeParams(req);
    if (scope.orgNodeId === null && scope.lineId === null && scope.stationId === null) {
      return res.status(400).json({ error: 'یکی از orgNodeId، lineId یا stationId لازم است' });
    }
    const pool = await getPool();
    const [tree, oee, restrictions, allowed] = await Promise.all([
      pool.request().execute('mes.GetReasonTree').then((r) => r.recordset),
      pool.request().execute('mes.GetOeeLossMapping').then((r) => r.recordset),
      runScoped(pool, 'mes.GetReasonRestrictionsInScope', scope, null),
      runScoped(pool, 'mes.GetAllowedReasonsInScope', scope, null),
    ]);
    res.json({ tree, oee, restrictions, allowed });
  })
);

/**
 * FRM-RM-08 — «پیمانکاران تولید».
 *
 * پیمانکار فعلاً با جدول‌های مستقل تعریف می‌شود و در درخت سازمانی نیست؛ پس
 * دامنه‌ی این فرم «یک پیمانکار» است (contractorId، خالی = همه). فهرست
 * پیمانکاران همیشه کامل برمی‌گردد تا پنل کناری پر بماند.
 * جدول‌ها/SP ها و داده‌ی نمونه با scripts/mes_frm_rm08_setup.sql ساخته می‌شوند.
 */
app.get(
  '/api/rm08/bundle',
  ah(async (req, res) => {
    const companyId = parseInt(req.query.companyId, 10) || 222;
    const contractorId = parseInt(req.query.contractorId, 10);
    const contractor = Number.isInteger(contractorId) ? contractorId : null;
    const win = windowParams(req);
    if (!win) return res.status(400).json({ error: 'تاریخ from نامعتبر است' });

    const pool = await getPool();
    const run = (proc, withContractor, withDate) => {
      const r = pool.request().input('CompanyId', sql.Int, companyId);
      if (withContractor) r.input('ContractorId', sql.Int, contractor);
      if (withDate) r.input('AsOfDate', sql.Date, win.fromDate);
      return r.execute(proc).then((x) => x.recordset);
    };
    const [contractors, capabilities, rates, inventories] = await Promise.all([
      run('mes.GetContractors', false, true),
      run('mes.GetContractorCapabilities', true, true),
      run('mes.GetContractorRates', true, true),
      run('mes.GetContractorInventories', true, false),
    ]);
    res.json({ today: win.today, asOf: win.from, contractors, capabilities, rates, inventories });
  })
);

/**
 * FRM-RM-09 — «مبانی هزینه‌یابی و ABC».
 *
 * داده‌ی پایه‌ی شرکت، بدون دامنه‌ی درخت: فعالیت‌ها، محرک‌های هزینه، کارکردهای
 * قابل استفاده به‌عنوان محرک، و تسهیم منبع مشترک بین مراکز هزینه.
 * جدول‌ها/SP ها و داده‌ی نمونه با scripts/mes_frm_rm09_setup.sql ساخته می‌شوند.
 */
app.get(
  '/api/rm09/bundle',
  ah(async (req, res) => {
    const companyId = parseInt(req.query.companyId, 10) || 222;
    const pool = await getPool();
    const run = (proc) => pool.request().input('CompanyId', sql.Int, companyId).execute(proc).then((r) => r.recordset);
    const [activities, drivers, capacityTypes, allocations] = await Promise.all([
      run('mes.GetProductionActivities'),
      run('mes.GetCostDrivers'),
      run('mes.GetCostDriverCapacityTypes'),
      run('mes.GetSharedResourceAllocations'),
    ]);
    res.json({ activities, drivers, capacityTypes, allocations });
  })
);

/**
 * FRM-PE-01 — «ویژگی‌های تولیدی قلم» (اولین فرم حوزه‌ی مهندسی محصول).
 *
 * دامنه‌ی این فرم یک کالاست (productId، خالی = همه)، نه درخت سازمانی. فهرست
 * کالاها و تعریف ویژگی‌ها و بُعدها همیشه کامل برمی‌گردند؛ بقیه به کالا محدود می‌شوند.
 * mes.Product جانشین موقت کاتالوگ انبار است.
 * جدول‌ها/SP ها و داده‌ی نمونه با scripts/mes_frm_pe01_setup.sql ساخته می‌شوند.
 */
app.get(
  '/api/pe01/bundle',
  ah(async (req, res) => {
    const companyId = parseInt(req.query.companyId, 10) || 222;
    const productIdRaw = parseInt(req.query.productId, 10);
    const productId = Number.isInteger(productIdRaw) ? productIdRaw : null;

    const pool = await getPool();
    const run = (proc, withProduct) => {
      const r = pool.request().input('CompanyId', sql.Int, companyId);
      if (withProduct) r.input('ProductId', sql.Int, productId);
      return r.execute(proc).then((x) => x.recordset);
    };
    const [items, policies, attributes, itemAttributes, dimensions, itemDimensionValues, variants, lotSizes] = await Promise.all([
      run('mes.GetProductionItems', false),
      run('mes.GetItemSupplyPolicies', true),
      run('mes.GetProductionAttributes', false),
      run('mes.GetItemAttributes', true),
      run('mes.GetProductionDimensions', false),
      run('mes.GetItemDimensionValues', true),
      run('mes.GetItemVariants', true),
      run('mes.GetItemLotSizes', true),
    ]);
    res.json({ items, policies, attributes, itemAttributes, dimensions, itemDimensionValues, variants, lotSizes });
  })
);

/**
 * FRM-PE-03 — «گروه جایگزین و سیاست جایگزینی».
 * groupId اختیاری: خالی = همه‌ی گروه‌ها. فهرست گروه‌ها همیشه کامل برمی‌گردد.
 * جدول‌ها/SP ها و داده‌ی نمونه با scripts/mes_frm_pe03_setup.sql ساخته می‌شوند.
 */
app.get(
  '/api/pe03/bundle',
  ah(async (req, res) => {
    const companyId = parseInt(req.query.companyId, 10) || 222;
    const groupId = optionalInt(req.query.groupId);
    const pool = await getPool();
    const run = (proc, withGroup) => {
      const r = pool.request().input('CompanyId', sql.Int, companyId);
      if (withGroup) r.input('GroupId', sql.Int, groupId);
      return r.execute(proc).then((x) => x.recordset);
    };
    const [groups, options, usage] = await Promise.all([
      run('mes.GetSubstituteGroups', false),
      run('mes.GetSubstituteGroupOptions', true),
      run('mes.GetSubstituteGroupUsage', true),
    ]);
    res.json({ groups, options, usage });
  })
);

/**
 * FRM-PE-04 — «خروجی‌های ساختار و بازدهی».
 * همه‌ی خروجی‌های همه‌ی ساختارها (داده کم است)؛ انتخاب ساختار سمت فرانت‌اند فیلتر می‌شود.
 * جدول‌ها/SP ها و داده‌ی نمونه با scripts/mes_frm_pe04_setup.sql ساخته می‌شوند.
 */
app.get(
  '/api/pe04/bundle',
  ah(async (req, res) => {
    const companyId = parseInt(req.query.companyId, 10) || 222;
    const pool = await getPool();
    const r = await pool.request().input('CompanyId', sql.Int, companyId).input('ProductStructureId', sql.Int, null).execute('mes.GetStructureOutputs');
    res.json({ outputs: r.recordset });
  })
);

/**
 * FRM-PE-05 — «بازیابی مواد در فرایند». داده‌ی پایه‌ی شرکت، بدون دامنه.
 * جدول‌ها/SP ها و داده‌ی نمونه با scripts/mes_frm_pe05_setup.sql ساخته می‌شوند.
 */
app.get(
  '/api/pe05/bundle',
  ah(async (req, res) => {
    const companyId = parseInt(req.query.companyId, 10) || 222;
    const pool = await getPool();
    const run = (proc) => pool.request().input('CompanyId', sql.Int, companyId).execute(proc).then((r) => r.recordset);
    const [policy, materials, formulaRows, outputs] = await Promise.all([
      run('mes.GetRecoveryPolicy'),
      run('mes.GetRecoveredMaterials'),
      run('mes.GetRecoveryFormulaRows'),
      run('mes.GetRecoveryOutputs'),
    ]);
    res.json({ policy: policy[0] ?? null, materials, formulaRows, outputs });
  })
);

/**
 * FRM-PE-06 — «ساختار ماتریسی و اقلام ابعادی».
 * فهرست ساختارهای مدل پایه، و برای ساختار انتخاب‌شده (structureId؛ خالی = اولی) ردیف‌ها و ساختار مشتق هر ترکیب.
 * جدول‌ها/SP ها و داده‌ی نمونه با scripts/mes_frm_pe06_setup.sql ساخته می‌شوند.
 */
app.get(
  '/api/pe06/bundle',
  ah(async (req, res) => {
    const companyId = parseInt(req.query.companyId, 10) || 222;
    const pool = await getPool();
    const structures = (await pool.request().input('CompanyId', sql.Int, companyId).execute('mes.GetMatrixStructures')).recordset;
    const id = optionalInt(req.query.structureId) ?? structures[0]?.StructureId ?? null;
    if (id === null) return res.json({ structureId: null, structures, items: [], derived: [] });
    const byId = (proc) => pool.request().input('ProductStructureId', sql.Int, id).execute(proc).then((r) => r.recordset);
    const [items, derived] = await Promise.all([byId('mes.GetMatrixItems'), byId('mes.GetDerivedVariantStructures')]);
    res.json({ structureId: id, structures, items, derived });
  })
);

/**
 * FRM-PE-08 — «نماها و محاسبات ساختار» (کنسول تحلیلی).
 *   /explode?structureId=&quantity=&applyWaste=1   بسط چندسطحی
 *   /where-used?productId=&multi=1                 کاربرد معکوس
 *   /cycles                                        کنترل حلقه‌ی بازگشتی
 * رویه‌ها با scripts/mes_frm_pe08_setup.sql ساخته می‌شوند.
 */
app.get(
  '/api/pe08/explode',
  ah(async (req, res) => {
    const id = optionalInt(req.query.structureId);
    if (id === null) return res.status(400).json({ error: 'structureId لازم است' });
    const qty = Number(req.query.quantity);
    const pool = await getPool();
    const r = await pool
      .request()
      .input('ProductStructureId', sql.Int, id)
      .input('Quantity', sql.Decimal(32, 6), Number.isFinite(qty) && qty > 0 ? qty : null)
      .input('ApplyWaste', sql.Bit, req.query.applyWaste === '0' ? 0 : 1)
      .execute('mes.ExplodeStructure');
    res.json(r.recordset);
  })
);

app.get(
  '/api/pe08/where-used',
  ah(async (req, res) => {
    const id = optionalInt(req.query.productId);
    if (id === null) return res.status(400).json({ error: 'productId لازم است' });
    const pool = await getPool();
    const r = await pool.request().input('ProductId', sql.Int, id).input('MultiLevel', sql.Bit, req.query.multi === '0' ? 0 : 1).execute('mes.GetWhereUsed');
    res.json(r.recordset);
  })
);

app.get(
  '/api/pe08/cycles',
  ah(async (_req, res) => {
    const pool = await getPool();
    const r = await pool.request().execute('mes.FindStructureCycles');
    res.json(r.recordset);
  })
);

/**
 * اندپوینت «بسته‌ی داده‌ی پایه‌ی شرکت»: هر کلید یک رویه با تنها پارامتر @CompanyId.
 * نام رویه‌ها ثابت و سمت سرور است، نه از مرورگر. فرم‌های مهندسی تولید (ME-02 به بعد) و PE-07 از این استفاده می‌کنند.
 */
const companyBundle = (procs) =>
  ah(async (req, res) => {
    const companyId = parseInt(req.query.companyId, 10) || 222;
    const pool = await getPool();
    const keys = Object.keys(procs);
    const sets = await Promise.all(
      keys.map((k) => pool.request().input('CompanyId', sql.Int, companyId).execute(procs[k]).then((r) => r.recordset))
    );
    res.json(Object.fromEntries(keys.map((k, i) => [k, sets[i]])));
  });

/**
 * مثل companyBundle، ولی هر کلید می‌تواند [رویه، [نام هر recordset]] باشد تا رویه‌های چندخروجی هم در یک بسته بیایند.
 * فرم‌های کنترل تولید (PC) از این استفاده می‌کنند.
 */
const companySets = (procs) =>
  ah(async (req, res) => {
    const companyId = parseInt(req.query.companyId, 10) || 222;
    const pool = await getPool();
    const entries = Object.entries(procs);
    const results = await Promise.all(
      entries.map(([, p]) => pool.request().input('CompanyId', sql.Int, companyId).execute(Array.isArray(p) ? p[0] : p))
    );
    const out = {};
    entries.forEach(([k, p], i) => {
      if (Array.isArray(p)) p[1].forEach((name, j) => (out[name] = results[i].recordsets[j] || []));
      else out[k] = results[i].recordset;
    });
    res.json(out);
  });

/** FRM-PC-01 — «درخواست تولید» (scripts/mes_frm_pc01_setup.sql). */
app.get(
  '/api/pc01/bundle',
  companySets({ requests: 'mes.GetProductionRequests', approvals: ['mes.GetProductionRequestApprovals', ['approvals', 'rules']] })
);

/** امکان‌سنجی یک درخواست در تاریخ دلخواه — فقط‌خواندنی. */
app.get(
  '/api/pc01/feasibility',
  ah(async (req, res) => {
    const requestId = optionalInt(req.query.requestId);
    if (requestId === null) return res.status(400).json({ error: 'درخواست لازم است' });
    const asOf = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.asOf || '')) ? String(req.query.asOf) : null;
    const pool = await getPool();
    const r = await pool.request().input('RequestId', sql.Int, requestId).input('AsOf', sql.Date, asOf).execute('mes.CheckRequestFeasibility');
    const [summary, materials] = r.recordsets;
    res.json({ summary: summary?.[0] || null, materials: materials || [] });
  })
);

/** FRM-PC-02 — «دستور کار تولید». */
app.get(
  '/api/pc02/bundle',
  companySets({
    orders: 'mes.GetWorkOrders',
    operations: 'mes.GetWorkOrderOperations',
    materials: 'mes.GetWorkOrderMaterials',
    products: 'mes.GetWorkOrderProducts',
    history: ['mes.GetWorkOrderHistory', ['changes', 'cancellations']],
  })
);

/** FRM-PC-03 — «آزادسازی و تأمین مواد». */
app.get(
  '/api/pc03/bundle',
  companySets({
    orders: 'mes.GetWorkOrders',
    checks: 'mes.GetReleaseChecks',
    kits: 'mes.GetMaterialKits',
    excess: ['mes.GetMaterialExcessAndReturns', ['excess', 'returns']],
    lineSide: 'mes.GetLineSideStock',
  })
);

/** FRM-PC-04 — «گزارش تولید». */
app.get(
  '/api/pc04/bundle',
  companySets({
    orders: 'mes.GetWorkOrders',
    operations: 'mes.GetWorkOrderOperations',
    reports: 'mes.GetProductionReports',
    details: ['mes.GetProductionReportDetails', ['labor', 'waste', 'rework', 'capacity']],
    shifts: ['mes.GetShiftReports', ['shifts', 'wip']],
  })
);

/** FRM-PC-05 — «پایانه‌ی کارگاه». */
app.get(
  '/api/pc05/bundle',
  companySets({
    terminals: 'mes.GetTerminals',
    queue: 'mes.GetTerminalQueue',
    stoppages: 'mes.GetOperationStoppages',
    readings: 'mes.GetParameterReadings',
    checklist: 'mes.GetOperationChecklist',
    device: 'mes.GetDeviceData',
  })
);

/** FRM-PC-06 — «مصرف مواد». */
app.get(
  '/api/pc06/bundle',
  companySets({ consumption: 'mes.GetMaterialConsumption', variance: 'mes.GetConsumptionVariance', recovered: 'mes.GetRecoveredBatchEligibility' })
);

/** FRM-PC-07 — «رسید محصول و هویت‌بخشی». */
app.get(
  '/api/pc07/bundle',
  companySets({
    receipts: 'mes.GetProductReceipts',
    recon: ['mes.GetReceiptReconciliation', ['reconReports', 'reconOutputs']],
    batches: ['mes.GetProductionBatches', ['batches', 'patterns']],
    attributes: 'mes.GetBatchAttributeProgress',
    serials: ['mes.GetSerialSummary', ['serials', 'serialPatterns']],
    genealogy: ['mes.GetGenealogyLinks', ['links', 'gaps']],
    labels: ['mes.GetLabelTemplates', ['templates', 'labelParts']],
  })
);

/** ردیابی بچ: direction=1 پس‌رو (اجزا)، 2 پیش‌رو (مصرف‌کننده‌ها). */
app.get(
  '/api/pc07/trace',
  ah(async (req, res) => {
    const batch = String(req.query.batch || '').slice(0, 64);
    if (!batch) return res.status(400).json({ error: 'شماره‌ی بچ لازم است' });
    const direction = optionalInt(req.query.direction) === 2 ? 2 : 1;
    const pool = await getPool();
    const r = await pool.request().input('CompanyId', sql.Int, 222).input('BatchNumber', sql.NVarChar(64), batch).input('Direction', sql.Int, direction).execute('mes.GetBatchTrace');
    res.json(r.recordset);
  })
);

/** جست‌وجوی سریال با والد و فرزندان. */
app.get(
  '/api/pc07/serial',
  ah(async (req, res) => {
    const serial = String(req.query.serial || '').trim().slice(0, 128);
    if (!serial) return res.status(400).json({ error: 'سریال لازم است' });
    const pool = await getPool();
    const r = await pool.request().input('CompanyId', sql.Int, 222).input('Serial', sql.NVarChar(128), serial).execute('mes.GetSerialLookup');
    const [found, children] = r.recordsets;
    res.json({ serial: found?.[0] || null, children: children || [] });
  })
);

/** FRM-PC-08 — «بازیابی مواد در اجرا». */
app.get('/api/pc08/bundle', companySets({ recovery: ['mes.GetRecoveryExecution', ['receipts', 'balances', 'standards']] }));

/** FRM-PC-09 — «ضایعات، دوباره‌کاری و بازیافت». */
app.get(
  '/api/pc09/bundle',
  companySets({
    dispositions: 'mes.GetNonconformingDispositions',
    rework: ['mes.GetReworkOrders', ['orders', 'operations', 'reports']],
    chains: 'mes.GetReworkChains',
    copq: 'mes.GetCopq',
    recovered: 'mes.GetRecoveredBatchEligibility',
  })
);

/** FRM-PC-10 — «اجرای برون‌سپاری و کارمزدی». */
app.get(
  '/api/pc10/bundle',
  companySets({
    subcontract: ['mes.GetSubcontractOrders', ['orders', 'progress']],
    shipments: ['mes.GetSubcontractShipments', ['shipments', 'items']],
    recon: 'mes.GetSubcontractReconciliation',
    toll: ['mes.GetTollStatement', ['contracts', 'statement']],
    ownership: ['mes.GetOwnershipSeparation', ['stock', 'consumption']],
  })
);

/** FRM-PC-11 — «پورتال پیمانکار و مشتری کارمزدی»: فهرست حساب‌ها. */
app.get('/api/pc11/bundle', companySets({ accounts: 'mes.GetPortalAccounts' }));

/**
 * نمای پورتال یک حساب. طرف (پیمانکار یا قرارداد کارمزدی) از خود حساب در پایگاه‌داده خوانده می‌شود،
 * نه از مرورگر؛ مرورگر فقط شناسه‌ی حساب را می‌فرستد.
 */
app.get(
  '/api/pc11/view',
  ah(async (req, res) => {
    const accountId = optionalInt(req.query.accountId);
    if (accountId === null) return res.status(400).json({ error: 'حساب لازم است' });
    const pool = await getPool();
    const a = await pool
      .request()
      .input('Id', sql.Int, accountId)
      .query('SELECT CAST(Id AS INT) AS AccountId, PartyTypeCode, CAST(ContractorId AS INT) AS ContractorId, CAST(TollingContractId AS INT) AS TollingContractId, CompanyId, CanReportProgress, CanViewBalances, CanViewFees, IsActive FROM mes.PortalAccount WHERE Id = @Id AND IsDeleted = 0');
    const acc = a.recordset[0];
    if (!acc) return res.status(404).json({ error: 'حساب پیدا نشد' });
    // حساب غیرفعال هیچ داده‌ای نمی‌بیند
    if (!acc.IsActive) return res.status(403).json({ error: 'حساب غیرفعال است', account: acc });
    const run = (proc, inputs) => {
      const rq = pool.request().input('CompanyId', sql.Int, Number(acc.CompanyId));
      Object.entries(inputs).forEach(([k, v]) => rq.input(k, sql.Int, v));
      return rq.execute(proc);
    };
    if (acc.PartyTypeCode === 1) {
      const [orders, shipments, recon] = await Promise.all([
        run('mes.GetSubcontractOrders', { ContractorId: acc.ContractorId }),
        run('mes.GetSubcontractShipments', { ContractorId: acc.ContractorId }),
        acc.CanViewBalances ? run('mes.GetSubcontractReconciliation', { ContractorId: acc.ContractorId }) : null,
      ]);
      const ord = orders.recordsets[0].map((o) => (acc.CanViewFees ? o : { ...o, FeePerUnit: null, FeePayable: null }));
      return res.json({ account: acc, orders: ord, progress: orders.recordsets[1], shipments: shipments.recordsets[0], items: shipments.recordsets[1], balances: recon ? recon.recordset : [] });
    }
    const [toll, shipments, progress] = await Promise.all([
      run('mes.GetTollStatement', { TollingContractId: acc.TollingContractId }),
      run('mes.GetSubcontractShipments', { TollingContractId: acc.TollingContractId }),
      run('mes.GetTollOrderProgress', { TollingContractId: acc.TollingContractId }),
    ]);
    const contracts = toll.recordsets[0].map((c) => (acc.CanViewFees ? c : { ...c, FeePerUnit: null, FeeEarned: null, FeeProjected: null }));
    res.json({ account: acc, contracts, balances: acc.CanViewBalances ? toll.recordsets[1] : [], shipments: shipments.recordsets[0], items: shipments.recordsets[1], operations: progress.recordset });
  })
);

/** FRM-PC-12 — «کنسول پایش و بستن دستور». */
app.get(
  '/api/pc12/bundle',
  companySets({
    dashboard: ['mes.GetProductionDashboard', ['lines', 'stations', 'orders', 'stops']],
    exceptions: ['mes.GetLiveExceptions', ['alerts', 'rules']],
    deviations: ['mes.GetWorkOrderDeviations', ['deviations', 'causes']],
    wip: 'mes.GetWipSummary',
    close: ['mes.GetCloseReadiness', ['readiness', 'events']],
  })
);

/** پیش‌نمایش رویداد بستن برای بهای تمام‌شده — فقط‌خواندنی، چیزی ارسال نمی‌شود. */
app.get(
  '/api/pc12/costing',
  ah(async (req, res) => {
    const workOrderId = optionalInt(req.query.workOrderId);
    if (workOrderId === null) return res.status(400).json({ error: 'دستور کار لازم است' });
    const pool = await getPool();
    const r = await pool.request().input('CompanyId', sql.Int, 222).input('WorkOrderId', sql.Int, workOrderId).execute('mes.GetCostingEventPreview');
    const [header, materials, resources, outputs] = r.recordsets;
    res.json({ header: header?.[0] || null, materials: materials || [], resources: resources || [], outputs: outputs || [] });
  })
);

/**
 * FRM-PC-13 — «اتاق جلسه‌ی کنترل تولید» (BI سناریومحور، scripts/mes_frm_pc13_setup.sql).
 * from/to بازه‌ی جریان رویداد و ماتریس روز×خط است (پیش‌فرض: دو هفته تا ساعت سناریو)؛ بقیه کل شرکت.
 */
app.get(
  '/api/pc13/bundle',
  ah(async (req, res) => {
    const companyId = parseInt(req.query.companyId, 10) || 222;
    const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
    const from = isDay(req.query.from) ? String(req.query.from) : '2026-09-26';
    const to = isDay(req.query.to) ? String(req.query.to) : '2026-10-10';
    const pool = await getPool();
    const run = (proc, extra) => {
      const rq = pool.request().input('CompanyId', sql.Int, companyId);
      if (extra) extra(rq);
      return rq.execute(proc);
    };
    const toExclusive = new Date(`${to}T00:00:00Z`);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
    const [facts, events, daily, alerts, deviations, copq, variance, dispositions, requests, materials, operations, recon, subcontract, close] = await Promise.all([
      run('mes.GetBiOrderFacts'),
      run('mes.GetBiEvents', (rq) => rq.input('From', sql.DateTime2, new Date(`${from}T00:00:00Z`)).input('To', sql.DateTime2, toExclusive)),
      run('mes.GetBiDailyLine', (rq) => rq.input('From', sql.Date, from).input('To', sql.Date, to)),
      run('mes.GetLiveExceptions'),
      run('mes.GetWorkOrderDeviations'),
      run('mes.GetCopq'),
      run('mes.GetConsumptionVariance'),
      run('mes.GetNonconformingDispositions'),
      run('mes.GetProductionRequests'),
      run('mes.GetWorkOrderMaterials'),
      run('mes.GetWorkOrderOperations'),
      run('mes.GetReceiptReconciliation'),
      run('mes.GetSubcontractOrders'),
      run('mes.GetCloseReadiness'),
    ]);
    res.json({
      from, to,
      facts: facts.recordset, events: events.recordset, daily: daily.recordset,
      alerts: alerts.recordsets[0], rules: alerts.recordsets[1],
      deviations: deviations.recordsets[0], causes: deviations.recordsets[1],
      copq: copq.recordset, variance: variance.recordset, dispositions: dispositions.recordset, requests: requests.recordset,
      materials: materials.recordset, operations: operations.recordset,
      reconReports: recon.recordsets[0], reconOutputs: recon.recordsets[1],
      subcontract: subcontract.recordsets[0], readiness: close.recordsets[0], closeEvents: close.recordsets[1],
    });
  })
);

/** FRM-ME-02 — «روش ساخت» (scripts/mes_frm_me02_setup.sql). */
app.get(
  '/api/me02/bundle',
  companyBundle({
    routings: 'mes.GetRoutings',
    assignments: 'mes.GetRoutingAssignments',
    operations: 'mes.GetRoutingOperations',
    links: 'mes.GetRoutingLinks',
    alternatives: 'mes.GetRoutingAlternatives',
    outputs: 'mes.GetRoutingOutputs',
  })
);

/** FRM-PE-07 — «پیکربندی محصول» (scripts/mes_frm_pe07_setup.sql). */
app.get(
  '/api/pe07/bundle',
  companyBundle({
    models: 'mes.GetConfigurationModels',
    values: 'mes.GetConfigurationValues',
    rules: 'mes.GetConfigurationRules',
    conditions: 'mes.GetConfigurationConditions',
  })
);

/** ساختار مؤثر برای یک ترکیب انتخاب — فقط‌خواندنی؛ values = شناسه‌ی مقادیر با ویرگول. */
app.get(
  '/api/pe07/resolve',
  ah(async (req, res) => {
    const modelId = optionalInt(req.query.modelId);
    const values = String(req.query.values || '')
      .split(',')
      .map((v) => parseInt(v, 10))
      .filter((v) => Number.isInteger(v) && v > 0);
    if (modelId === null) return res.status(400).json({ error: 'مدل پیکربندی لازم است' });
    const pool = await getPool();
    const r = await pool.request().input('ModelId', sql.Int, modelId).input('ValueIds', sql.NVarChar(4000), values.join(',')).execute('mes.ResolveConfiguredStructure');
    const [violations, items] = r.recordsets;
    res.json({ violations, items });
  })
);

/** FRM-ME-10 — «فعالیت و محرک هزینه‌ی عملیات» (scripts/mes_frm_me10_setup.sql). */
app.get(
  '/api/me10/bundle',
  companyBundle({ routings: 'mes.GetRoutings', activities: 'mes.GetRoutingOperationActivities', shares: 'mes.GetRoutingOutputCostShares' })
);

/** FRM-ME-09 — «تولید پیوسته و کمپین» (scripts/mes_frm_me09_setup.sql). */
app.get(
  '/api/me09/bundle',
  companyBundle({ routings: 'mes.GetContinuousRoutings', templates: 'mes.GetShiftOrderTemplates', handovers: 'mes.GetShiftHandoverRules' })
);

/** FRM-ME-08 — «نسخه‌ی تولید» (scripts/mes_frm_me08_setup.sql). */
app.get('/api/me08/bundle', companyBundle({ versions: 'mes.GetManufacturingVersions' }));

/** انتخاب خودکار نسخه‌ی تولید برای یک سفارش فرضی — فقط‌خواندنی، با دلیل رد هر نسخه. */
app.get(
  '/api/me08/select',
  ah(async (req, res) => {
    const companyId = parseInt(req.query.companyId, 10) || 222;
    const productId = optionalInt(req.query.productId);
    const lineId = optionalInt(req.query.lineId);
    const quantity = Number(req.query.quantity);
    const orderType = optionalInt(req.query.orderType) ?? 1;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || '')) ? String(req.query.date) : new Date().toISOString().slice(0, 10);
    if (productId === null || lineId === null || !Number.isFinite(quantity)) return res.status(400).json({ error: 'کالا، خط و مقدار لازم است' });
    const pool = await getPool();
    const r = await pool
      .request()
      .input('CompanyId', sql.Int, companyId)
      .input('ProductId', sql.Int, productId)
      .input('LineId', sql.Int, lineId)
      .input('Quantity', sql.Decimal(32, 6), quantity)
      .input('OrderDate', sql.Date, date)
      .input('OrderTypeCode', sql.Int, orderType)
      .execute('mes.SelectManufacturingVersion');
    res.json(r.recordset);
  })
);

/** FRM-ME-07 — «برون‌سپاری و کارمزدی» (scripts/mes_frm_me07_setup.sql). */
app.get(
  '/api/me07/bundle',
  companyBundle({
    operations: 'mes.GetOutsourcedOperations',
    subcontracts: 'mes.GetRoutingSubcontracts',
    items: 'mes.GetRoutingSubcontractItems',
    toll: 'mes.GetRoutingTollMaterials',
  })
);

/** FRM-ME-06 — «سیاست‌های تغذیه، مصرف و رسید» (scripts/mes_frm_me06_setup.sql). */
app.get('/api/me06/bundle', companyBundle({ policies: 'mes.GetMaterialPolicies', items: 'mes.GetPolicyItems' }));

/** FRM-ME-05 — «عملیات بازیابی مواد» (scripts/mes_frm_me05_setup.sql). */
app.get('/api/me05/bundle', companyBundle({ recoveries: 'mes.GetRoutingRecoveries', coverage: 'mes.GetRecoveredMaterialCoverage' }));

/** FRM-ME-04 — «اقلام و خروجی در سطح عملیات» (scripts/mes_frm_me04_setup.sql). */
app.get(
  '/api/me04/bundle',
  companyBundle({
    routings: 'mes.GetRoutings',
    links: 'mes.GetRoutingLinks',
    stages: 'mes.GetRoutingStages',
    materials: 'mes.GetRoutingMaterials',
    outputs: 'mes.GetRoutingOutputs',
    coverage: 'mes.GetRoutingOutputCoverage',
    attributes: 'mes.GetRoutingBatchAttributes',
  })
);

/** FRM-ME-03 — «کارکرد استاندارد و زمان عملیات» (scripts/mes_frm_me03_setup.sql). */
app.get(
  '/api/me03/bundle',
  ah(async (req, res) => {
    const companyId = parseInt(req.query.companyId, 10) || 222;
    const pool = await getPool();
    const run = (proc) => pool.request().input('CompanyId', sql.Int, companyId).execute(proc);
    const [routings, timings, capacities, changeover] = await Promise.all([
      run('mes.GetRoutings'),
      run('mes.GetRoutingTimings'),
      run('mes.GetRoutingCapacities'),
      run('mes.GetRoutingChangeovers'),
    ]);
    const [changeovers, classes, productClasses] = changeover.recordsets;
    res.json({ routings: routings.recordset, timings: timings.recordset, capacities: capacities.recordset, changeovers, classes, productClasses });
  })
);

/**
 * FRM-ME-01 — «کتابخانه‌ی عملیات».
 * درخت گروه، عملیات، منابع لازم (ایستگاه/گروه منبع، مهارت، ابزار، انرژی)، دستورالعمل‌ها و پارامترهای
 * فرایندی کل شرکت در یک درخواست؛ فیلتر گروه/عملیات سمت فرانت انجام می‌شود (داده‌ی پایه‌ی کوچک).
 * جدول‌ها/SP ها و داده‌ی نمونه با scripts/mes_frm_me01_setup.sql ساخته می‌شوند.
 */
app.get(
  '/api/me01/bundle',
  ah(async (req, res) => {
    const companyId = parseInt(req.query.companyId, 10) || 222;
    const pool = await getPool();
    const run = (proc) => pool.request().input('CompanyId', sql.Int, companyId).execute(proc).then((r) => r.recordset);
    const [groups, operations, resources, instructions, parameters] = await Promise.all([
      run('mes.GetOperationGroupTree'),
      run('mes.GetLibraryOperations'),
      run('mes.GetOperationResources'),
      run('mes.GetOperationInstructions'),
      run('mes.GetOperationParameters'),
    ]);
    res.json({ groups, operations, resources, instructions, parameters });
  })
);

/**
 * FRM-PE-09 — «مدیریت تغییر مهندسی (ECO)».
 * فهرست ECOها و برای ECO انتخاب‌شده (ecoId؛ خالی = اولین ECO منتظر تأیید) دامنه، تأییدها، اطلاع‌رسانی و تحلیل اثر.
 * جدول‌ها/SP ها و داده‌ی نمونه با scripts/mes_frm_pe09_setup.sql ساخته می‌شوند.
 */
app.get(
  '/api/pe09/bundle',
  ah(async (req, res) => {
    const companyId = parseInt(req.query.companyId, 10) || 222;
    const pool = await getPool();
    const ecos = (await pool.request().input('CompanyId', sql.Int, companyId).execute('mes.GetEcos')).recordset;
    const id = optionalInt(req.query.ecoId) ?? (ecos.find((e) => e.StatusCode === 3) ?? ecos[0])?.EcoId ?? null;
    if (id === null) return res.json({ ecoId: null, ecos, items: [], approvals: [], notifications: [], impact: [] });
    const [detail, impact] = await Promise.all([
      pool.request().input('EcoId', sql.Int, id).execute('mes.GetEcoDetail'),
      pool.request().input('EcoId', sql.Int, id).execute('mes.GetEcoImpact'),
    ]);
    const [items, approvals, notifications] = detail.recordsets;
    res.json({ ecoId: id, ecos, items, approvals, notifications, impact: impact.recordset });
  })
);

/**
 * FRM-PE-02 — «ساختار محصول».
 *
 * دامنه‌ی این فرم یک ساختار است. سه درخواست جدا:
 *   /structures            فهرست ساختارها (پنل کناری و سربرگ)
 *   /structures/:id        جزئیات یک ساختار؛ revisionId اختیاری (خالی = نسخه‌ی جاری)
 *   /diff                  مقایسه‌ی دو ساختار یا دو نسخه (F-PE-017)
 * جدول‌ها/SP ها و داده‌ی نمونه با scripts/mes_frm_pe02_setup.sql ساخته می‌شوند.
 */
const optionalInt = (v) => {
  const n = parseInt(v, 10);
  return Number.isInteger(n) ? n : null;
};

app.get(
  '/api/pe02/structures',
  ah(async (req, res) => {
    const companyId = parseInt(req.query.companyId, 10) || 222;
    const pool = await getPool();
    const r = await pool.request().input('CompanyId', sql.Int, companyId).execute('mes.GetProductStructures');
    res.json(r.recordset);
  })
);

app.get(
  '/api/pe02/structures/:id',
  ah(async (req, res) => {
    const id = optionalInt(req.params.id);
    if (id === null) return res.status(400).json({ error: 'شناسه‌ی ساختار نامعتبر است' });
    const revisionId = optionalInt(req.query.revisionId);
    const pool = await getPool();
    const byId = (proc) => pool.request().input('ProductStructureId', sql.Int, id).execute(proc).then((r) => r.recordset);
    const [items, revisions, scopes, typeChanges, transitions, attachments] = await Promise.all([
      pool
        .request()
        .input('ProductStructureId', sql.Int, id)
        .input('RevisionId', sql.Int, revisionId)
        .execute('mes.GetStructureItems')
        .then((r) => r.recordset),
      byId('mes.GetStructureRevisions'),
      byId('mes.GetStructureScopes'),
      byId('mes.GetStructureTypeChanges'),
      pool.request().execute('mes.GetStructureTypeTransitions').then((r) => r.recordset),
      byId('mes.GetStructureAttachments'),
    ]);
    res.json({ revisionId, items, revisions, scopes, typeChanges, transitions, attachments });
  })
);

app.get(
  '/api/pe02/diff',
  ah(async (req, res) => {
    const left = optionalInt(req.query.left);
    const right = optionalInt(req.query.right);
    if (left === null || right === null) return res.status(400).json({ error: 'دو ساختار (left و right) لازم است' });
    const pool = await getPool();
    const r = await pool
      .request()
      .input('LeftStructureId', sql.Int, left)
      .input('LeftRevisionId', sql.Int, optionalInt(req.query.leftRevision))
      .input('RightStructureId', sql.Int, right)
      .input('RightRevisionId', sql.Int, optionalInt(req.query.rightRevision))
      .execute('mes.GetStructureDiff');
    res.json(r.recordset);
  })
);

/**
 * «منبع داده زنده» — دکمه‌ی سه‌نقطه‌ی گوشه‌ی هر گرید/فرم (شیء DataSourceBadge
 * سمت فرانت‌اند). طبق تصمیم کاربر، این از الان استاندارد کل سیستم GNG+ است،
 * نه فقط FRM-RM-01: هر فرم تازه که این الگو را استفاده کند فقط کافی است یک
 * ردیف به INSPECT_REGISTRY زیر اضافه کند.
 *
 * نکته‌ی امنیتی مهم: کلاینت هیچ‌وقت نام SP/جدول/ستون واقعی را نمی‌فرستد —
 * فقط یک «کلید» (مثلاً rm01-topology) که در همین رجیستری سمت سرور از قبل
 * تعریف شده. تنها چیزی که از کلاینت وارد یک رشته‌ی SQL می‌شود مقدار فیلتر
 * است (filterVal) که همیشه با پارامتر (sql.Int) می‌رود، نه با رشته‌چینی —
 * یعنی تزریق SQL از این مسیر ممکن نیست.
 */
const INSPECT_REGISTRY = {
  'rm01-org-tree': { procedure: 'mes.GetOrgTree', table: 'mes.OrgNode', filterCol: 'CompanyId' },
  'rm01-ancestry': { procedure: 'mes.GetLineAncestry', table: 'mes.OrgNode', filterCol: 'CompanyId' },
  'rm01-lines': { procedure: 'mes.GetProductionLines', table: 'mes.ProductionLine', filterCol: null },
  'rm01-topology': { procedure: 'mes.GetStationsUnderNode', table: 'mes.WorkCenter', filterCol: 'ProductionLineId' },
  'rm01-links': { procedure: 'mes.GetStationLinksUnderNode', table: 'mes.WorkCenterLink', filterCol: 'ProductionLineId' },
  'rm01-node-ancestry': { procedure: 'mes.GetNodeAncestry', table: 'mes.OrgNode', filterCol: 'CompanyId' },
  'rm01-resource-groups': { procedure: 'mes.GetResourceGroups', table: 'mes.ResourceGroup', filterCol: 'CompanyId' },
  'rm01-mobile-resources': { procedure: 'mes.GetMobileResources', table: 'mes.MobileResource', filterCol: 'CompanyId' },
  'rm02-equipment': { procedure: 'mes.GetEquipmentInScope', table: 'mes.Equipment', filterCol: 'CompanyId' },
  'rm02-attributes': { procedure: 'mes.GetEquipmentAttributesInScope', table: 'mes.EquipmentAttribute', filterCol: null },
  'rm02-capabilities': { procedure: 'mes.GetEquipmentCapabilitiesInScope', table: 'mes.EquipmentCapability', filterCol: null },
  'rm02-tools': { procedure: 'mes.GetToolsInScope', table: 'mes.ToolsProduction', filterCol: 'CompanyId' },
  'rm02-changeover': { procedure: 'mes.GetChangeoverInScope', table: 'mes.ChangeoverTime', filterCol: null },
  'rm02-software': { procedure: 'mes.GetEquipmentSoftwareInScope', table: 'mes.EquipmentSoftware', filterCol: null },
  'rm03-personnel': { procedure: 'mes.GetPersonnelInScope', table: 'mes.ProductionPersonnel', filterCol: 'CompanyId' },
  'rm03-skills': { procedure: 'mes.GetSkillsInScope', table: 'mes.Skill', filterCol: 'CompanyId' },
  'rm03-matrix': { procedure: 'mes.GetPersonnelSkillsInScope', table: 'mes.PersonnelSkill', filterCol: 'CompanyId' },
  'rm03-requirements': { procedure: 'mes.GetOperationSkillRequirementsInScope', table: 'mes.OperationSkillRequirement', filterCol: 'CompanyId' },
  'rm03-working-groups': { procedure: 'mes.GetWorkingGroupsInScope', table: 'mes.ProductionWorkingGroup', filterCol: 'CompanyId' },
  'rm03-station-labor': { procedure: 'mes.GetPersonnelStationsInScope', table: 'mes.WorkCenterLabor', filterCol: 'CompanyId' },
  'rm04-shifts': { procedure: 'mes.GetWorkingShifts', table: 'mes.ProductionWorkingShift', filterCol: 'CompanyId' },
  'rm04-breaks': { procedure: 'mes.GetWorkingShiftBreaks', table: 'mes.ProductionWorkingShiftBreak', filterCol: 'CompanyId' },
  'rm04-rotations': { procedure: 'mes.GetShiftRotationDays', table: 'mes.ShiftRotationDay', filterCol: 'CompanyId' },
  'rm04-assignments': { procedure: 'mes.GetShiftRotationAssignmentsInScope', table: 'mes.ShiftRotationAssignment', filterCol: 'CompanyId' },
  'rm04-roster': { procedure: 'mes.GetShiftRosterInScope', table: 'mes.ProductionCalendarDetail', filterCol: 'CompanyId' },
  'rm04-absences': { procedure: 'mes.GetAbsencesInScope', table: 'mes.PersonnelAbsence', filterCol: 'CompanyId' },
  'rm05-rules': { procedure: 'mes.GetCalendarRules', table: 'mes.ProductionCalendarRule', filterCol: 'CompanyId' },
  'rm05-inheritance': { procedure: 'mes.GetCalendarInheritanceInScope', table: 'mes.ProductionCalendarRule', filterCol: 'CompanyId' },
  'rm05-effective': { procedure: 'mes.GetEffectiveCalendarInScope', table: 'mes.ProductionCalendar', filterCol: 'CompanyId' },
  'rm05-exceptions': { procedure: 'mes.GetCalendarExceptionsInScope', table: 'mes.ProductionCalendarException', filterCol: 'CompanyId' },
  'rm05-shutdowns': { procedure: 'mes.GetShutdownsInScope', table: 'mes.ProductionShutdownDetail', filterCol: 'CompanyId' },
  'rm01-warehouses': { procedure: 'mes.GetLineSideWarehouses', table: 'mes.LineSideInventory', filterCol: 'CompanyId' },
  'rm06-types': { procedure: 'mes.GetCapacityTypes', table: 'mes.CapacityType', filterCol: 'CompanyId' },
  'rm06-capacities': { procedure: 'mes.GetCapacitiesInScope', table: 'mes.WorkCenterCapacity', filterCol: 'CompanyId' },
  'rm06-availability': { procedure: 'mes.GetCapacitiesInScope', table: 'mes.WorkCenterCapacity', filterCol: 'CompanyId' },
  'rm06-product-rates': { procedure: 'mes.GetProductRatesInScope', table: 'mes.WorkCenterProductRate', filterCol: 'CompanyId' },
  'rm06-load': { procedure: 'mes.GetCapacityLoadInScope', table: 'mes.CapacityRequirmentScheduling', filterCol: 'CompanyId' },
  'rm06-history': { procedure: 'mes.GetCapacityHistoryInScope', table: 'mes.WorkCenterCapacity', filterCol: 'CompanyId' },
  'rm07-stoppage': { procedure: 'mes.GetReasonTree', table: 'mes.ProductionProblem', filterCol: 'CompanyId' },
  'rm07-stoppage-groups': { procedure: 'mes.GetReasonTree', table: 'mes.ProductionProblemGroup', filterCol: 'CompanyId' },
  'rm07-waste': { procedure: 'mes.GetReasonTree', table: 'mes.ProductionWasteReason', filterCol: 'CompanyId' },
  'rm07-rework': { procedure: 'mes.GetReasonTree', table: 'mes.ProductionReworkReason', filterCol: 'CompanyId' },
  'rm07-deviation': { procedure: 'mes.GetReasonTree', table: 'mes.ProductionPlanDeviation', filterCol: 'CompanyId' },
  'rm07-oee': { procedure: 'mes.GetOeeLossMapping', table: 'mes.OeeLoss', filterCol: 'CompanyId' },
  'rm07-restrictions': { procedure: 'mes.GetReasonRestrictionsInScope', table: 'mes.ProductionReasonRestriction', filterCol: 'CompanyId' },
  'rm07-allowed': { procedure: 'mes.GetAllowedReasonsInScope', table: 'mes.ProductionReasonRestriction', filterCol: 'CompanyId' },
  'rm08-contractors': { procedure: 'mes.GetContractors', table: 'mes.ProductionContractor', filterCol: 'CompanyId' },
  'rm08-capabilities': { procedure: 'mes.GetContractorCapabilities', table: 'mes.ProductionContractorCapability', filterCol: 'CompanyId' },
  'rm08-rates': { procedure: 'mes.GetContractorRates', table: 'mes.ProductionContractorRate', filterCol: 'CompanyId' },
  'rm08-inventories': { procedure: 'mes.GetContractorInventories', table: 'mes.ProductionContractorInventory', filterCol: 'CompanyId' },
  'rm09-activities': { procedure: 'mes.GetProductionActivities', table: 'mes.ProductionActivity', filterCol: 'CompanyId' },
  'rm09-drivers': { procedure: 'mes.GetCostDrivers', table: 'mes.CostDriver', filterCol: 'CompanyId' },
  'rm09-types': { procedure: 'mes.GetCostDriverCapacityTypes', table: 'mes.CapacityType', filterCol: 'CompanyId' },
  'rm09-allocations': { procedure: 'mes.GetSharedResourceAllocations', table: 'mes.SharedResourceAllocation', filterCol: 'CompanyId' },
  'pe01-items': { procedure: 'mes.GetProductionItems', table: 'mes.ProductionItem', filterCol: 'CompanyId' },
  'pe01-catalog': { procedure: 'mes.GetProductionItems', table: 'mes.Product', filterCol: 'CompanyId' },
  'pe01-policies': { procedure: 'mes.GetItemSupplyPolicies', table: 'mes.ProductionItemSupplyPolicy', filterCol: 'CompanyId' },
  'pe01-attributes': { procedure: 'mes.GetProductionAttributes', table: 'mes.ProductionAttribute', filterCol: 'CompanyId' },
  'pe01-item-attributes': { procedure: 'mes.GetItemAttributes', table: 'mes.ProductionItemAttribute', filterCol: 'CompanyId' },
  'pe01-dimensions': { procedure: 'mes.GetProductionDimensions', table: 'mes.ProductionDimensionValue', filterCol: 'CompanyId' },
  'pe01-variants': { procedure: 'mes.GetItemVariants', table: 'mes.ProductionItemVariant', filterCol: 'CompanyId' },
  'pe01-lot-sizes': { procedure: 'mes.GetItemLotSizes', table: 'mes.ProductionItemLotSize', filterCol: 'CompanyId' },
  'pe07-models': { procedure: 'mes.GetConfigurationModels', table: 'mes.ProductConfigurationModel', filterCol: 'CompanyId' },
  'pe07-values': { procedure: 'mes.GetConfigurationValues', table: 'mes.ProductConfigurationValue', filterCol: 'CompanyId' },
  'pe07-rules': { procedure: 'mes.GetConfigurationRules', table: 'mes.ProductConfigurationRule', filterCol: 'CompanyId' },
  'pe07-conditions': { procedure: 'mes.GetConfigurationConditions', table: 'mes.ProductStructureItemCondition', filterCol: 'CompanyId' },
  'pe07-resolve': { procedure: 'mes.ResolveConfiguredStructure', table: 'mes.ProductStructureItemCondition', filterCol: 'CompanyId' },
  'me10-activities': { procedure: 'mes.GetRoutingOperationActivities', table: 'mes.RoutingOperationActivity', filterCol: 'CompanyId' },
  'me10-shares': { procedure: 'mes.GetRoutingOutputCostShares', table: 'mes.RoutingOperationOutput', filterCol: 'CompanyId' },
  'me09-routings': { procedure: 'mes.GetContinuousRoutings', table: 'mes.RoutingMaster', filterCol: 'CompanyId' },
  'me09-templates': { procedure: 'mes.GetShiftOrderTemplates', table: 'mes.ShiftOrderTemplate', filterCol: 'CompanyId' },
  'me09-handovers': { procedure: 'mes.GetShiftHandoverRules', table: 'mes.ShiftHandoverRule', filterCol: 'CompanyId' },
  'me08-versions': { procedure: 'mes.GetManufacturingVersions', table: 'mes.ManufacturingVersion', filterCol: 'CompanyId' },
  'me08-select': { procedure: 'mes.SelectManufacturingVersion', table: 'mes.ManufacturingVersion', filterCol: 'CompanyId' },
  'me07-operations': { procedure: 'mes.GetOutsourcedOperations', table: 'mes.RoutingOperation', filterCol: 'CompanyId' },
  'me07-subcontracts': { procedure: 'mes.GetRoutingSubcontracts', table: 'mes.RoutingOperationSubcontract', filterCol: 'CompanyId' },
  'me07-items': { procedure: 'mes.GetRoutingSubcontractItems', table: 'mes.RoutingOperationSubcontractItem', filterCol: 'CompanyId' },
  'me07-toll': { procedure: 'mes.GetRoutingTollMaterials', table: 'mes.RoutingTollMaterial', filterCol: 'CompanyId' },
  'me06-policies': { procedure: 'mes.GetMaterialPolicies', table: 'mes.ProductionMaterialPolicy', filterCol: 'CompanyId' },
  'me06-items': { procedure: 'mes.GetPolicyItems', table: 'mes.RoutingOperationMaterial', filterCol: 'CompanyId' },
  'me05-recoveries': { procedure: 'mes.GetRoutingRecoveries', table: 'mes.RoutingOperationRecovery', filterCol: 'CompanyId' },
  'me05-coverage': { procedure: 'mes.GetRecoveredMaterialCoverage', table: 'mes.RecoveredMaterial', filterCol: 'CompanyId' },
  'me04-materials': { procedure: 'mes.GetRoutingMaterials', table: 'mes.RoutingOperationMaterial', filterCol: 'CompanyId' },
  'me04-outputs': { procedure: 'mes.GetRoutingOutputs', table: 'mes.RoutingOperationOutput', filterCol: 'CompanyId' },
  'me04-coverage': { procedure: 'mes.GetRoutingOutputCoverage', table: 'mes.ProductStructureMaster', filterCol: 'CompanyId' },
  'me04-stages': { procedure: 'mes.GetRoutingStages', table: 'mes.RoutingOperation', filterCol: 'CompanyId' },
  'me04-attributes': { procedure: 'mes.GetRoutingBatchAttributes', table: 'mes.RoutingOperationBatchAttribute', filterCol: 'CompanyId' },
  'me03-timings': { procedure: 'mes.GetRoutingTimings', table: 'mes.RoutingOperationTiming', filterCol: 'CompanyId' },
  'me03-capacities': { procedure: 'mes.GetRoutingCapacities', table: 'mes.RoutingOperationCapacity', filterCol: 'CompanyId' },
  'me03-changeovers': { procedure: 'mes.GetRoutingChangeovers', table: 'mes.ChangeoverTime', filterCol: 'CompanyId' },
  'me02-routings': { procedure: 'mes.GetRoutings', table: 'mes.RoutingMaster', filterCol: 'CompanyId' },
  'me02-operations': { procedure: 'mes.GetRoutingOperations', table: 'mes.RoutingOperation', filterCol: 'CompanyId' },
  'me02-links': { procedure: 'mes.GetRoutingLinks', table: 'mes.RoutingOperationLink', filterCol: 'CompanyId' },
  'me02-alternatives': { procedure: 'mes.GetRoutingAlternatives', table: 'mes.RoutingOperationAlternative', filterCol: 'CompanyId' },
  'me02-assignments': { procedure: 'mes.GetRoutingAssignments', table: 'mes.RoutingProductStructureAssignment', filterCol: 'CompanyId' },
  'me01-groups': { procedure: 'mes.GetOperationGroupTree', table: 'mes.ProductionOperationGroup', filterCol: 'CompanyId' },
  'me01-operations': { procedure: 'mes.GetLibraryOperations', table: 'mes.ProductionOperation', filterCol: 'CompanyId' },
  'me01-resources': { procedure: 'mes.GetOperationResources', table: 'mes.ProductionOperationResource', filterCol: 'CompanyId' },
  'me01-instructions': { procedure: 'mes.GetOperationInstructions', table: 'mes.ProductionOperationInstruction', filterCol: 'CompanyId' },
  'me01-parameters': { procedure: 'mes.GetOperationParameters', table: 'mes.ProductionOperationParameter', filterCol: 'CompanyId' },
  'pe03-groups': { procedure: 'mes.GetSubstituteGroups', table: 'mes.SubstituteGroup', filterCol: 'CompanyId' },
  'pe03-options': { procedure: 'mes.GetSubstituteGroupOptions', table: 'mes.SubstituteGroupMember', filterCol: 'CompanyId' },
  'pe03-usage': { procedure: 'mes.GetSubstituteGroupUsage', table: 'mes.ProductStructureItem', filterCol: 'CompanyId' },
  'pe04-outputs': { procedure: 'mes.GetStructureOutputs', table: 'mes.ProductStructureMaster', filterCol: 'CompanyId' },
  'pe05-materials': { procedure: 'mes.GetRecoveredMaterials', table: 'mes.RecoveredMaterial', filterCol: 'CompanyId' },
  'pe05-formula': { procedure: 'mes.GetRecoveryFormulaRows', table: 'mes.ProductStructureItem', filterCol: 'CompanyId' },
  'pe06-structures': { procedure: 'mes.GetMatrixStructures', table: 'mes.ProductStructure', filterCol: 'CompanyId' },
  'pe06-items': { procedure: 'mes.GetMatrixItems', table: 'mes.ProductStructureItemDimensionValue', filterCol: 'CompanyId' },
  'pe06-derived': { procedure: 'mes.GetDerivedVariantStructures', table: 'mes.ProductionItemVariant', filterCol: 'CompanyId' },
  'pe08-explode': { procedure: 'mes.ExplodeStructure', table: 'mes.ProductStructureItem', filterCol: 'CompanyId' },
  'pe08-where-used': { procedure: 'mes.GetWhereUsed', table: 'mes.ProductStructureItem', filterCol: 'CompanyId' },
  'pe09-ecos': { procedure: 'mes.GetEcos', table: 'mes.EngineeringChangeOrder', filterCol: 'CompanyId' },
  'pe09-items': { procedure: 'mes.GetEcoDetail', table: 'mes.EngineeringChangeOrderItem', filterCol: 'CompanyId' },
  'pe09-approvals': { procedure: 'mes.GetEcoDetail', table: 'mes.EngineeringChangeOrderApproval', filterCol: 'CompanyId' },
  'pe09-impact': { procedure: 'mes.GetEcoImpact', table: 'mes.EngineeringChangeOrderItem', filterCol: 'CompanyId' },
  'pe02-structures': { procedure: 'mes.GetProductStructures', table: 'mes.ProductStructure', filterCol: 'CompanyId' },
  'pe02-items': { procedure: 'mes.GetStructureItems', table: 'mes.ProductStructureItem', filterCol: 'ProductStructureId' },
  'pe02-revisions': { procedure: 'mes.GetStructureRevisions', table: 'mes.ProductStructureRevision', filterCol: 'ProductStructureId' },
  'pe02-scopes': { procedure: 'mes.GetStructureScopes', table: 'mes.ProductStructureSite', filterCol: 'ProductStructureId' },
  'pe02-type-changes': { procedure: 'mes.GetStructureTypeChanges', table: 'mes.ProductStructureTypeChange', filterCol: 'ProductStructureId' },
  'pe02-attachments': { procedure: 'mes.GetStructureAttachments', table: 'mes.ProductStructureAttachment', filterCol: 'ProductStructureId' },
  'pe02-diff': { procedure: 'mes.GetStructureDiff', table: 'mes.ProductStructureItem', filterCol: 'ProductStructureId' },
  'pc01-requests': { procedure: 'mes.GetProductionRequests', table: 'mes.ProductionRequest', filterCol: 'CompanyId' },
  'pc01-approvals': { procedure: 'mes.GetProductionRequestApprovals', table: 'mes.ProductionRequestApproval', filterCol: 'CompanyId' },
  'pc01-feasibility': { procedure: 'mes.CheckRequestFeasibility', table: 'mes.MaterialStock', filterCol: 'CompanyId' },
  'pc01-links': { procedure: 'mes.GetProductionRequests', table: 'mes.ProductionRequestWorkOrder', filterCol: 'CompanyId' },
  'pc02-orders': { procedure: 'mes.GetWorkOrders', table: 'mes.WorkOrder', filterCol: 'CompanyId' },
  'pc02-operations': { procedure: 'mes.GetWorkOrderOperations', table: 'mes.WorkOrderOperation', filterCol: 'CompanyId' },
  'pc02-materials': { procedure: 'mes.GetWorkOrderMaterials', table: 'mes.WorkOrderOperationMaterial', filterCol: 'CompanyId' },
  'pc02-products': { procedure: 'mes.GetWorkOrderProducts', table: 'mes.WorkOrderProduct', filterCol: 'CompanyId' },
  'pc02-history': { procedure: 'mes.GetWorkOrderHistory', table: 'mes.WorkOrderChangeLog', filterCol: 'CompanyId' },
  'pc03-checks': { procedure: 'mes.GetReleaseChecks', table: 'mes.WorkOrder', filterCol: 'CompanyId' },
  'pc03-kits': { procedure: 'mes.GetMaterialKits', table: 'mes.WorkOrderOperationMaterialKit', filterCol: 'CompanyId' },
  'pc03-excess': { procedure: 'mes.GetMaterialExcessAndReturns', table: 'mes.WorkOrderOperationMaterialExcess', filterCol: 'CompanyId' },
  'pc03-returns': { procedure: 'mes.GetMaterialExcessAndReturns', table: 'mes.WorkOrderOperationMaterialReturned', filterCol: 'CompanyId' },
  'pc03-line-side': { procedure: 'mes.GetLineSideStock', table: 'mes.MaterialStock', filterCol: 'CompanyId' },
  'pc04-reports': { procedure: 'mes.GetProductionReports', table: 'mes.WorkOrderOperationOutput', filterCol: 'CompanyId' },
  'pc04-labor': { procedure: 'mes.GetProductionReportDetails', table: 'mes.WorkOrderOperationOutputLabor', filterCol: 'CompanyId' },
  'pc04-waste': { procedure: 'mes.GetProductionReportDetails', table: 'mes.WorkOrderOperationOutputWaste', filterCol: 'CompanyId' },
  'pc04-capacity': { procedure: 'mes.GetProductionReportDetails', table: 'mes.WorkOrderOperationCapacityUsage', filterCol: 'CompanyId' },
  'pc04-shifts': { procedure: 'mes.GetShiftReports', table: 'mes.ShiftReport', filterCol: 'CompanyId' },
  'pc05-terminals': { procedure: 'mes.GetTerminals', table: 'mes.ShopFloorTerminal', filterCol: 'CompanyId' },
  'pc05-queue': { procedure: 'mes.GetTerminalQueue', table: 'mes.WorkOrderOperation', filterCol: 'CompanyId' },
  'pc05-stoppages': { procedure: 'mes.GetOperationStoppages', table: 'mes.WorkOrderOperationProblem', filterCol: 'CompanyId' },
  'pc05-readings': { procedure: 'mes.GetParameterReadings', table: 'mes.WorkOrderOperationParameterReading', filterCol: 'CompanyId' },
  'pc05-checklist': { procedure: 'mes.GetOperationChecklist', table: 'mes.WorkOrderOperationInstruction', filterCol: 'CompanyId' },
  'pc05-device': { procedure: 'mes.GetDeviceData', table: 'mes.PLCItemData', filterCol: 'CompanyId' },
  'pc06-consumption': { procedure: 'mes.GetMaterialConsumption', table: 'mes.WorkOrderOperationMaterialConsumed', filterCol: 'CompanyId' },
  'pc06-variance': { procedure: 'mes.GetConsumptionVariance', table: 'mes.WorkOrderOperationMaterial', filterCol: 'CompanyId' },
  'pc06-recovered': { procedure: 'mes.GetRecoveredBatchEligibility', table: 'mes.MaterialStock', filterCol: 'CompanyId' },
  'pc07-receipts': { procedure: 'mes.GetProductReceipts', table: 'mes.WorkOrderOperationOutputProduct', filterCol: 'CompanyId' },
  'pc07-recon': { procedure: 'mes.GetReceiptReconciliation', table: 'mes.WorkOrderOperationOutputProduct', filterCol: 'CompanyId' },
  'pc07-batches': { procedure: 'mes.GetProductionBatches', table: 'mes.ProductionBatch', filterCol: 'CompanyId' },
  'pc07-patterns': { procedure: 'mes.GetProductionBatches', table: 'mes.ProductionLineBatchNumberSetting', filterCol: 'CompanyId' },
  'pc07-attributes': { procedure: 'mes.GetBatchAttributeProgress', table: 'mes.ProductionBatchAttributeValue', filterCol: 'CompanyId' },
  'pc07-serials': { procedure: 'mes.GetSerialSummary', table: 'mes.ProductSerial', filterCol: 'CompanyId' },
  'pc07-genealogy': { procedure: 'mes.GetGenealogyLinks', table: 'mes.ProductionBatchGenealogy', filterCol: 'CompanyId' },
  'pc07-trace': { procedure: 'mes.GetBatchTrace', table: 'mes.ProductionBatchGenealogy', filterCol: 'CompanyId' },
  'pc07-labels': { procedure: 'mes.GetLabelTemplates', table: 'mes.ProductLabelTemplateDetail', filterCol: 'CompanyId' },
  'pc08-receipts': { procedure: 'mes.GetRecoveryExecution', table: 'mes.WorkOrderOperationOutputProduct', filterCol: 'CompanyId' },
  'pc08-balances': { procedure: 'mes.GetRecoveryExecution', table: 'mes.WorkOrderMaterialBalance', filterCol: 'CompanyId' },
  'pc09-dispositions': { procedure: 'mes.GetNonconformingDispositions', table: 'mes.NonconformingDisposition', filterCol: 'CompanyId' },
  'pc09-rework': { procedure: 'mes.GetReworkOrders', table: 'mes.WorkOrder', filterCol: 'CompanyId' },
  'pc09-chains': { procedure: 'mes.GetReworkChains', table: 'mes.NonconformingDisposition', filterCol: 'CompanyId' },
  'pc09-copq': { procedure: 'mes.GetCopq', table: 'mes.NonconformingDisposition', filterCol: 'CompanyId' },
  'pc10-orders': { procedure: 'mes.GetSubcontractOrders', table: 'mes.SubcontractProgress', filterCol: 'CompanyId' },
  'pc10-shipments': { procedure: 'mes.GetSubcontractShipments', table: 'mes.SubcontractShipmentItem', filterCol: 'CompanyId' },
  'pc10-recon': { procedure: 'mes.GetSubcontractReconciliation', table: 'mes.SubcontractShipment', filterCol: 'CompanyId' },
  'pc10-toll': { procedure: 'mes.GetTollStatement', table: 'mes.TollingContract', filterCol: 'CompanyId' },
  'pc10-ownership': { procedure: 'mes.GetOwnershipSeparation', table: 'mes.MaterialStock', filterCol: 'CompanyId' },
  'pc11-accounts': { procedure: 'mes.GetPortalAccounts', table: 'mes.PortalAccount', filterCol: 'CompanyId' },
  'pc11-progress': { procedure: 'mes.GetTollOrderProgress', table: 'mes.SubcontractProgress', filterCol: 'CompanyId' },
  'pc12-dashboard': { procedure: 'mes.GetProductionDashboard', table: 'mes.WorkOrderOperation', filterCol: 'CompanyId' },
  'pc12-exceptions': { procedure: 'mes.GetLiveExceptions', table: 'mes.ExceptionRule', filterCol: 'CompanyId' },
  'pc12-alerts': { procedure: 'mes.GetLiveExceptions', table: 'mes.ExceptionAlert', filterCol: 'CompanyId' },
  'pc12-deviations': { procedure: 'mes.GetWorkOrderDeviations', table: 'mes.WorkOrderDeviation', filterCol: 'CompanyId' },
  'pc12-wip': { procedure: 'mes.GetWipSummary', table: 'mes.WorkOrderOperation', filterCol: 'CompanyId' },
  'pc12-close': { procedure: 'mes.GetCloseReadiness', table: 'mes.WorkOrderCloseEvent', filterCol: 'CompanyId' },
  'pc12-costing': { procedure: 'mes.GetCostingEventPreview', table: 'mes.WorkOrderCloseEvent', filterCol: 'CompanyId' },
  'pc13-facts': { procedure: 'mes.GetBiOrderFacts', table: 'mes.WorkOrder', filterCol: 'CompanyId' },
  'pc13-events': { procedure: 'mes.GetBiEvents', table: 'mes.WorkOrderOperationOutput', filterCol: 'CompanyId' },
  'pc13-daily': { procedure: 'mes.GetBiDailyLine', table: 'mes.WorkOrderOperationProblem', filterCol: 'CompanyId' },
};

app.get(
  '/api/_inspect/:key',
  ah(async (req, res) => {
    const entry = INSPECT_REGISTRY[req.params.key];
    if (!entry) return res.status(404).json({ error: 'منبع‌داده‌ی ناشناخته' });

    const pool = await getPool();

    const defResult = await pool
      .request()
      .input('objectName', sql.NVarChar, entry.procedure)
      .query('SELECT OBJECT_DEFINITION(OBJECT_ID(@objectName)) AS definitionSql');

    let sampleRows;
    if (entry.filterCol && req.query.filterVal !== undefined) {
      // entry.table و entry.filterCol همیشه از همین رجیستری ثابت سمت سرور
      // می‌آیند، نه از کلاینت — فقط مقدار (filterVal) از کلاینت است و با
      // پارامتر امن می‌رود.
      const q = `SELECT TOP (20) * FROM ${entry.table} WHERE ${entry.filterCol} = @filterVal`;
      const r = await pool
        .request()
        .input('filterVal', sql.Int, parseInt(req.query.filterVal, 10))
        .query(q);
      sampleRows = r.recordset;
    } else {
      const r = await pool.request().query(`SELECT TOP (20) * FROM ${entry.table}`);
      sampleRows = r.recordset;
    }

    // ستون‌های دودویی (RowVersion، Picture) در JSON به شکل آرایه‌ی بایت می‌آیند و
    // جدول نمونه را ناخوانا می‌کنند؛ فقط طولشان نشان داده می‌شود.
    const readable = sampleRows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k, Buffer.isBuffer(v) ? `<binary ${v.length} bytes>` : v])
      )
    );

    res.json({
      procedure: entry.procedure,
      table: entry.table,
      definitionSql: defResult.recordset[0]?.definitionSql || '',
      sampleRows: readable,
    });
  })
);

const PORT = process.env.API_PORT || 4311;
app.listen(PORT, () => {
  console.log(`gng-mfr-api is running at http://localhost:${PORT}`);
  if (!process.env.DB_USER || !process.env.DB_PASSWORD) {
    console.warn('[WARNING] DB_USER / DB_PASSWORD are empty in .env - fill them in and restart.');
  }
});
