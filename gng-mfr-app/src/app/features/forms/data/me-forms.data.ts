import { FeatureArtifactType, FeatureComplexity, FeaturePriority, FormShellConfig } from '../../../core/models/form-shell.model';

/**
 * داده‌ی فرم‌های حوزه‌ی «مهندسی تولید» (ME) — عیناً برگرفته از:
 * alm.Form (WHERE AnalysisDocumentCode = 'ALM-DOC-ME')
 * alm.FormFeatureMapping ⨝ alm.Feature (WHERE FormCode LIKE 'FRM-ME-%')
 * alm.Menu (WHERE SubSystemCode='mes' AND ParentCode='440')
 *
 * هر تاپل فیچر: [Code, Requirement, Title, ArtifactType, Priority, Complexity]
 */
type FeatureTuple = [string, string, string, FeatureArtifactType, FeaturePriority, FeatureComplexity];

const DOMAIN_TITLE = 'مهندسی تولید';
const DOMAIN_CODE = 'ME';

function buildFeatures(rows: FeatureTuple[]) {
  return rows.map(([code, requirement, title, artifactType, priority, complexity]) => ({
    code,
    requirement,
    title,
    artifactType,
    priority,
    complexity,
  }));
}

function splitTabs(desc: string): string[] {
  return desc.split('·').map((t) => t.trim());
}

export const ME_FORMS: FormShellConfig[] = [
  {
    code: 'FRM-ME-01',
    title: 'کتابخانه‌ی عملیات',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('درخت گروه عملیات · عملیات استاندارد · منابع مورد نیاز · دستورالعمل کار · چک‌لیست · پارامترهای فرایندی · الزامات HSE'),
    features: buildFeatures([
      ['F-ME-001', 'ME-OPR-001', 'تعریف درخت گروه عملیات و عملیات استاندارد کتابخانه‌ای، قابل استفاده مجدد در روش‌های مختلف', 'BasicForm', 'M', 'Simple'],
      ['F-ME-002', 'ME-OPR-002', 'تعیین ماهیت عملیات', 'BasicForm', 'M', 'Simple'],
      ['F-ME-003', 'ME-OPR-003', 'تعیین منابع مورد نیاز عملیات', 'BasicForm', 'M', 'Simple'],
      ['F-ME-004', 'ME-OPR-004', 'تعریف دستورالعمل کار چندرسانه‌ای', 'SpecializedUI', 'M', 'Complex'],
      ['F-ME-005', 'ME-OPR-005', 'تعریف چک‌لیست اجرایی عملیات با اقلام الزامی/اختیاری و ثبت پاسخ در گزارش تولید', 'ReportDashboard', 'S', 'Simple'],
      ['F-ME-006', 'ME-OPR-006', 'تعریف پارامترهای فرایندی هدف (دما، فشار، سرعت، زمان همزدن) با محدوده‌ی مجاز', 'BasicForm', 'M', 'Simple'],
      ['F-ME-007', 'ME-OPR-007', 'تعیین الزامات ایمنی/HSE عملیات و تجهیزات حفاظت فردی', 'BasicForm', 'C', 'Simple'],
    ]),
  },
  {
    code: 'FRM-ME-02',
    title: 'روش ساخت',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('اطلاعات کلی · گراف عملیات · عملیات جایگزین · نسخه و اعتبار · کارمزدی دریافتی'),
    features: buildFeatures([
      ['F-ME-008', 'ME-RTG-001', 'تعریف روش ساخت با اختصاص به یک یا چند محصول/نیمه‌ساخته', 'BasicForm', 'M', 'Simple'],
      ['F-ME-009', 'ME-RTG-002', 'ورژنینگ و اعتبار', 'BasicForm', 'M', 'Simple'],
      ['F-ME-010', 'ME-RTG-003', 'پشتیبانی از روش تک‌مرحله‌ای و چندمرحله‌ای به‌صورت صریح', 'BasicForm', 'M', 'Simple'],
      ['F-ME-011', 'ME-RTG-004', 'تعریف عملیات موازی', 'BasicForm', 'M', 'Simple'],
      ['F-ME-012', 'ME-RTG-005', 'تعریف عملیات جایگزین با شرط انتخاب: بازه‌ی مقدار سفارش، در دسترس‌بودن منبع، انتخاب کاربر،…', 'BasicForm', 'M', 'Medium'],
      ['F-ME-013', 'ME-RTG-006', 'تعریف عملیات هم‌پوشان (Overlap)', 'BasicForm', 'M', 'Simple'],
      ['F-ME-014', 'ME-RTG-007', 'تعریف عملیات شرطی که اجرای آن به پارامتر سفارش یا نتیجه‌ی کیفی وابسته است', 'BasicForm', 'S', 'Simple'],
      ['F-ME-015', 'ME-RTG-008', 'ویرایشگر گرافیکی روش ساخت: ساخت و ویرایش گراف عملیات به‌صورت بصری با درگ‌اند‌دراپ', 'SpecializedUI', 'M', 'VeryComplex'],
      ['F-ME-016', 'ME-RTG-009', 'اعتبارسنجی گراف', 'CalcEngine', 'M', 'VeryComplex'],
      ['F-ME-017', 'ME-RTG-010', 'تعریف روش ساخت به‌عنوان الگو و اشتقاق از آن', 'BasicForm', 'M', 'Simple'],
      ['F-ME-018', 'ME-RTG-011', 'کپی و مقایسه‌ی نسخه‌های روش ساخت', 'BasicForm', 'M', 'Simple'],
      ['F-ME-019', 'ME-RTG-012', 'تعریف روش ساخت برای کارمزدی دریافتی', 'BasicForm', 'M', 'Simple'],
    ]),
  },
  {
    code: 'FRM-ME-03',
    title: 'کارکرد استاندارد و زمان عملیات',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('کارکردهای عملیات · مبنای محاسبه · زمان‌ها · ماتریس تعویض · اندازه‌ی بچ · منحنی یادگیری'),
    features: buildFeatures([
      ['F-ME-020', 'ME-STD-001', 'تخصیص هر نوع کارکرد استاندارد تعریف‌شده در RM به عملیات', 'BasicForm', 'M', 'Simple'],
      ['F-ME-021', 'ME-STD-002', 'تعیین مبنای محاسبه برای هر کارکرد', 'BasicForm', 'M', 'Medium'],
      ['F-ME-022', 'ME-STD-003', 'تفکیک صریح زمان راه‌اندازی', 'BasicForm', 'M', 'Simple'],
      ['F-ME-023', 'ME-STD-004', 'زمان راه‌اندازی وابسته به توالی: ماتریس زمان تعویض بین جفت محصول/رنگ/گرید', 'SpecializedUI', 'M', 'VeryComplex'],
      ['F-ME-024', 'ME-STD-005', 'تعریف زمان انتظار/فرایند غیرفعال', 'BasicForm', 'M', 'Medium'],
      ['F-ME-025', 'ME-STD-006', 'تعریف زمان انتقال بین عملیات و اندازه‌ی دسته‌ی انتقال', 'BasicForm', 'M', 'Simple'],
      ['F-ME-026', 'ME-STD-007', 'تعیین اندازه‌ی بچ استاندارد عملیات و رفتار در صورت اختلاف با اندازه‌ی سفارش', 'BasicForm', 'M', 'Simple'],
      ['F-ME-027', 'ME-STD-008', 'تعریف منحنی یادگیری یا ضریب کارایی به‌ازای منبع/محصول', 'BasicForm', 'C', 'Simple'],
      ['F-ME-028', 'ME-STD-009', 'دریافت پیشنهاد اصلاح استاندارد از داده‌ی واقعی', 'PlatformInfra', 'S', 'Medium'],
    ]),
  },
  {
    code: 'FRM-ME-04',
    title: 'اقلام و خروجی در سطح عملیات',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('تخصیص اقلام · نقطه‌ی مصرف · خروجی‌های عملیات · ضایعات فرایند و عملیات · ذخیره‌سازی بین‌مرحله‌ای · ویژگی‌های بچ'),
    features: buildFeatures([
      ['F-ME-029', 'ME-MAT-001', 'تخصیص اقلام مصرفی ساختار محصول به عملیات', 'BasicForm', 'M', 'Simple'],
      ['F-ME-030', 'ME-MAT-002', 'تعیین نقطه‌ی مصرف (Point of Consumption)', 'BasicForm', 'M', 'Simple'],
      ['F-ME-031', 'ME-MAT-003', 'تخصیص خروجی‌ها', 'BasicForm', 'M', 'Simple'],
      ['F-ME-032', 'ME-MAT-004', 'تعیین ضایعات فرایند در سطح روش ساخت و ضایعات عملیات در سطح عملیات', 'BasicForm', 'M', 'Medium'],
      ['F-ME-033', 'ME-MAT-005', 'تعیین بازده انباشته', 'CalcEngine', 'M', 'Complex'],
      ['F-ME-034', 'ME-MAT-006', 'تعیین کالای تولیدی هر عملیات', 'BasicForm', 'M', 'Simple'],
      ['F-ME-035', 'ME-MAT-007', 'تعیین سیاست ذخیره‌سازی بین‌مرحله‌ای', 'BasicForm', 'M', 'Simple'],
      ['F-ME-039', 'ME-MAT-008', 'تعریف ویژگی‌های بچ که در هر عملیات تعیین یا به‌روز می‌شوند', 'ServiceIntegration', 'M', 'Complex'],
    ]),
  },
  {
    code: 'FRM-ME-05',
    title: 'عملیات بازیابی مواد',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('عملیات بازیابی · نرخ و تلفات · انبار و سند رسید · محل اجرا'),
    features: buildFeatures([
      ['F-ME-036', 'ME-MAT-007-A', 'تعریف عملیات بازیابی (تقطیر، تغلیظ، جداسازی، فیلتراسیون) در روش ساخت', 'BasicForm', 'M', 'Medium'],
      ['F-ME-037', 'ME-MAT-007-B', 'تعیین انبار و الگوی سند رسید ماده‌ی بازیابی‌شده، و اینکه بلافاصله به همان دستور بازگردد یا…', 'BasicForm', 'M', 'Medium'],
      ['F-ME-038', 'ME-MAT-007-C', 'تعیین اینکه بازیابی در همان خط انجام شود، در واحد بازیابی مرکزی، یا برون‌سپاری شود', 'BasicForm', 'S', 'Simple'],
    ]),
  },
  {
    code: 'FRM-ME-06',
    title: 'سیاست‌های تغذیه، مصرف و رسید',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('سیاست تغذیه · سیاست مصرف و Backflush · اقلام مستثنی · سیاست رسید · انبار و الگوی سند · تخصیص موجودی · انتقال پای کار · محدوده‌ی مصرف'),
    features: buildFeatures([
      ['F-ME-040', 'ME-POL-001', 'تعیین سیاست تغذیه به‌ازای قلم/گروه قلم', 'PlatformInfra', 'M', 'Complex'],
      ['F-ME-041', 'ME-POL-002', 'تعیین سیاست مصرف', 'CalcEngine', 'M', 'Complex'],
      ['F-ME-042', 'ME-POL-003', 'تنظیمات Backflush', 'CalcEngine', 'M', 'Complex'],
      ['F-ME-043', 'ME-POL-004', 'تعیین اقلام مستثنی از Backflush', 'CalcEngine', 'M', 'Complex'],
      ['F-ME-044', 'ME-POL-005', 'تعیین سیاست رسید محصول', 'BasicForm', 'M', 'Simple'],
      ['F-ME-045', 'ME-POL-006', 'تعیین انبار پیش‌فرض مصرف و رسید و الگوی سند انبار به تفکیک قلم، گروه قلم و عملیات', 'BasicForm', 'M', 'Simple'],
      ['F-ME-046', 'ME-POL-007', 'تعیین سیاست تخصیص موجودی', 'BasicForm', 'M', 'Simple'],
      ['F-ME-047', 'ME-POL-008', 'بازطراحی انتقال پای کار با مفهوم اندازه‌ی بچ: محاسبه‌ی مقدار انتقال بر مبنای اندازه‌ی بچ…', 'CalcEngine', 'M', 'VeryComplex'],
      ['F-ME-048', 'ME-POL-009', 'تعیین سطح موجودی حداقل/حداکثر انبار پای کار و آستانه‌ی فراخوان مجدد', 'CalcEngine', 'M', 'Complex'],
      ['F-ME-049', 'ME-POL-010', 'کنترل محدوده‌ی مصرف مجاز در زمان ثبت گزارش تولید', 'ReportDashboard', 'M', 'Simple'],
    ]),
  },
  {
    code: 'FRM-ME-07',
    title: 'برون‌سپاری و کارمزدی',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('عملیات برون‌سپاری · اقلام ارسالی و دریافتی · نرخ و شرایط · پیمانکار جایگزین · کارمزدی دریافتی · تسویه‌ی مازاد'),
    features: buildFeatures([
      ['F-ME-050', 'ME-OUT-001', 'تعریف عملیات از نوع برون‌سپاری', 'BasicForm', 'M', 'Simple'],
      ['F-ME-051', 'ME-OUT-002', 'تعیین اقلام ارسالی به پیمانکار', 'BasicForm', 'M', 'Simple'],
      ['F-ME-052', 'ME-OUT-003', 'تعیین نرخ کارمزد، واحد محاسبه، زمان تحویل استاندارد، و ضایعات مجاز نزد پیمانکار', 'BasicForm', 'M', 'Simple'],
      ['F-ME-053', 'ME-OUT-004', 'تعیین آنکه پیمانکار مواد را خود تامین می‌کند یا از ما دریافت می‌کند', 'BasicForm', 'M', 'Simple'],
      ['F-ME-054', 'ME-OUT-005', 'تعریف چند پیمانکار جایگزین برای یک عملیات با اولویت و شرط انتخاب', 'BasicForm', 'S', 'Simple'],
      ['F-ME-055', 'ME-OUT-006', 'تعریف روش ساخت کارمزدی دریافتی (Subcontract-In)', 'BasicForm', 'M', 'Simple'],
      ['F-ME-056', 'ME-OUT-007', 'تفکیک اقلام مالکیت مشتری از اقلام خودمان در ساختار و مصرف کارمزدی', 'BasicForm', 'M', 'Simple'],
      ['F-ME-057', 'ME-OUT-008', 'تعیین نحوه‌ی تسویه‌ی ضایعات و مازاد مواد امانی', 'BasicForm', 'M', 'Simple'],
      ['F-ME-058', 'ME-OUT-009', 'اتصال عملیات برون‌سپاری به فرایند درخواست خرید خدمت در سیستم تدارکات', 'BasicForm', 'M', 'Simple'],
    ]),
  },
  {
    code: 'FRM-ME-08',
    title: 'نسخه‌ی تولید',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('ترکیب ساختار و روش · دامنه‌ی مکانی · محدوده‌ی اندازه‌ی بچ · اعتبار و اولویت · انواع مجاز · چرخه‌ی عمر · هزینه و زمان مبنا'),
    features: buildFeatures([
      ['F-ME-059', 'ME-PVR-001', 'تعریف نسخه‌ی تولید به‌عنوان ترکیب ساختار محصول + روش ساخت + دامنه‌ی مکانی + محدوده‌ی…', 'BasicForm', 'M', 'Simple'],
      ['F-ME-060', 'ME-PVR-002', 'تعیین نوع تولید و نوع دستور کار مجاز روی هر نسخه‌ی تولید', 'BasicForm', 'M', 'Simple'],
      ['F-ME-061', 'ME-PVR-003', 'تعیین اعتبار', 'BasicForm', 'M', 'Simple'],
      ['F-ME-062', 'ME-PVR-004', 'انتخاب خودکار نسخه‌ی تولید در زمان صدور سفارش بر مبنای', 'CalcEngine', 'M', 'VeryComplex'],
      ['F-ME-063', 'ME-PVR-005', 'نمایش دلیل انتخاب و فهرست نسخه‌های رد شده با علت', 'BasicForm', 'S', 'Simple'],
      ['F-ME-064', 'ME-PVR-006', 'امکان انتخاب دستی نسخه توسط کاربر مجاز', 'BasicForm', 'M', 'Simple'],
      ['F-ME-065', 'ME-PVR-007', 'تعیین وضعیت نسخه: پیش‌نویس، در تایید، فعال، معلق، منسوخ', 'PlatformInfra', 'M', 'Medium'],
      ['F-ME-066', 'ME-PVR-008', 'تعیین هزینه‌ی مبنا/زمان مبنا هر نسخه برای مقایسه‌ی گزینه‌ها', 'BasicForm', 'S', 'Simple'],
      ['F-ME-067', 'ME-PVR-009', 'نسخه‌ی تولید برای دستور کار شیفتی (پروفایل پیوسته)', 'PlatformInfra', 'M', 'Medium'],
    ]),
  },
  {
    code: 'FRM-ME-09',
    title: 'تولید پیوسته و کمپین',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('روش ساخت پیوسته · دستور شیفتی · کمپین · موازنه‌ی جرم · انتقال شیفت'),
    features: buildFeatures([
      ['F-ME-068', 'ME-CNT-001', 'تعریف روش ساخت پیوسته با مبنای نرخ', 'PlatformInfra', 'M', 'Medium'],
      ['F-ME-069', 'ME-CNT-002', 'تعریف دستور کار شیفتی به‌عنوان الگوی مبنای دستور در نسخه‌ی تولید', 'BasicForm', 'M', 'Medium'],
      ['F-ME-070', 'ME-CNT-003', 'تعریف کمپین: توالی محصولات روی یک خط پیوسته با زمان تعویض بین آن‌ها و حداقل زمان اجرا', 'PlatformInfra', 'S', 'Medium'],
      ['F-ME-071', 'ME-CNT-004', 'تعریف قواعد موازنه‌ی جرم و انرژی روی روش ساخت پیوسته', 'CalcEngine', 'S', 'VeryComplex'],
      ['F-ME-072', 'ME-CNT-005', 'مدیریت انتقال شیفت', 'BasicForm', 'M', 'Simple'],
    ]),
  },
  {
    code: 'FRM-ME-10',
    title: 'فعالیت و محرک هزینه‌ی عملیات',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('فعالیت عملیات · محرک هزینه · سهم هم‌زادها · ارزش‌افزا و غیرارزش‌افزا'),
    features: buildFeatures([
      ['F-ME-073', 'ME-ABC-001', 'ارتباط هر عملیات با یک یا چند فعالیت تعریف‌شده در RM-COS-001', 'BasicForm', 'S', 'Simple'],
      ['F-ME-074', 'ME-ABC-002', 'تعیین محرک هزینه‌ی هر فعالیت روی عملیات و مبنای گردآوری آن از کارکردهای استاندارد', 'BasicForm', 'S', 'Simple'],
      ['F-ME-075', 'ME-ABC-003', 'تعیین سهم عملیات از هزینه‌ی محصولات هم‌زاد', 'BasicForm', 'S', 'Simple'],
      ['F-ME-076', 'ME-ABC-004', 'تفکیک هزینه‌ی ارزش‌افزا از غیر‌ارزش‌افزا در سطح عملیات', 'BasicForm', 'C', 'Simple'],
    ]),
  },
];
