import { FeatureArtifactType, FeatureComplexity, FeaturePriority, FormShellConfig } from '../../../core/models/form-shell.model';

/**
 * داده‌ی فرم‌های حوزه‌ی «کنترل تولید» (PC) — عیناً برگرفته از:
 * alm.Form (WHERE AnalysisDocumentCode = 'ALM-DOC-PC')
 * alm.FormFeatureMapping ⨝ alm.Feature (WHERE FormCode LIKE 'FRM-PC-%')
 * alm.Menu (WHERE SubSystemCode='mes' AND ParentCode='450')
 *
 * هر تاپل فیچر: [Code, Requirement, Title, ArtifactType, Priority, Complexity]
 */
type FeatureTuple = [string, string, string, FeatureArtifactType, FeaturePriority, FeatureComplexity];

const DOMAIN_TITLE = 'کنترل تولید';
const DOMAIN_CODE = 'PC';

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

export const PC_FORMS: FormShellConfig[] = [
  {
    code: 'FRM-PC-01',
    title: 'درخواست تولید',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('ثبت درخواست · منشأ و اولویت · امکان‌سنجی · تجمیع و تفکیک · پیگیری وضعیت'),
    features: buildFeatures([
      ['F-PC-001', 'PC-REQ-001', 'ثبت درخواست تولید با منشأ', 'BasicForm', 'M', 'Simple'],
      ['F-PC-002', 'PC-REQ-002', 'اتصال به فرم اعلام نیاز عمومی سازمان', 'ServiceIntegration', 'M', 'Complex'],
      ['F-PC-003', 'PC-REQ-003', 'گردش تایید درخواست بر مبنای نوع، مقدار، محصول و واحد درخواست‌کننده', 'PlatformInfra', 'M', 'Medium'],
      ['F-PC-004', 'PC-REQ-004', 'تجمیع چند درخواست در یک دستور کار و تفکیک یک درخواست به چند دستور', 'BasicForm', 'M', 'Simple'],
      ['F-PC-005', 'PC-REQ-005', 'نمایش وضعیت پیشرفت درخواست به واحد درخواست‌کننده', 'BasicForm', 'M', 'Simple'],
      ['F-PC-006', 'PC-REQ-006', 'بررسی امکان‌پذیری اولیه (ATP/CTP) در زمان ثبت', 'BasicForm', 'S', 'Simple'],
    ]),
  },
  {
    code: 'FRM-PC-02',
    title: 'دستور کار',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('اطلاعات کلی · اقلام و خروجی · عملیات · بچ و سریال · دستور شیفتی · پیوند والد-فرزند'),
    features: buildFeatures([
      ['F-PC-007', 'PC-ORD-001', 'تعریف انواع دستور کار', 'PlatformInfra', 'M', 'Complex'],
      ['F-PC-008', 'PC-ORD-002', 'صدور دستور بر مبنای', 'PlatformInfra', 'M', 'Complex'],
      ['F-PC-009', 'PC-ORD-003', 'انتخاب خودکار نسخه‌ی تولید', 'CalcEngine', 'M', 'VeryComplex'],
      ['F-PC-010', 'PC-ORD-004', 'صدور گروهی دستور از روی برنامه‌ی تولید یا فهرست درخواست‌ها', 'BasicForm', 'M', 'Simple'],
      ['F-PC-011', 'PC-ORD-005', 'صدور خودکار دستورهای نیمه‌ساخته (چندسطحی) بر مبنای دستور محصول', 'CalcEngine', 'M', 'VeryComplex'],
      ['F-PC-012', 'PC-ORD-006', 'تعیین اولویت و درجه‌ی فوریت دستور، و اثر آن در توالی‌دهی و تخصیص مواد', 'BasicForm', 'M', 'Simple'],
      ['F-PC-013', 'PC-ORD-007', 'تعیین تاریخ شروع/پایان برنامه‌ای و محاسبه‌ی معکوس از تاریخ تحویل', 'CalcEngine', 'M', 'Complex'],
      ['F-PC-014', 'PC-ORD-008', 'نمایش کمبود مواد و ظرفیت پیش از آزادسازی', 'BasicForm', 'M', 'Simple'],
      ['F-PC-015', 'PC-ORD-009', 'تقسیم (Split) و ادغام (Merge) دستور کار با حفظ ردیابی', 'BasicForm', 'S', 'Simple'],
      ['F-PC-016', 'PC-ORD-010', 'تغییر مقدار یا نسخه‌ی دستور پس از آزادسازی', 'CalcEngine', 'M', 'Complex'],
      ['F-PC-017', 'PC-ORD-011', 'ابطال دستور با تعیین تکلیف مواد شارژشده و کار انجام‌شده', 'BasicForm', 'M', 'Simple'],
      ['F-PC-018', 'PC-ORD-012', 'دستور کار شیفتی', 'CalcEngine', 'M', 'VeryComplex'],
      ['F-PC-019', 'PC-ORD-013', 'تخصیص بچ به دستور در زمان صدور، یا تکمیل تدریجی مشخصات بچ در مراحل بعد', 'BasicForm', 'M', 'Simple'],
    ]),
  },
  {
    code: 'FRM-PC-03',
    title: 'آزادسازی، شارژ و تغذیه‌ی پای کار',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('آزادسازی و پیش‌شرط‌ها · دستور شارژ · انتقال پای کار · تخصیص و رزرو موجودی · مازاد و برگشتی · موجودی لحظه‌ای'),
    features: buildFeatures([
      ['F-PC-020', 'PC-FED-001', 'آزادسازی دستور با کنترل پیش‌شرط‌ها', 'BasicForm', 'M', 'Simple'],
      ['F-PC-021', 'PC-FED-002', 'صدور دستور شارژ بر مبنای سیاست تغذیه‌ی هر قلم', 'BasicForm', 'M', 'Simple'],
      ['F-PC-022', 'PC-FED-003', 'بازطراحی انتقال پای کار بر مبنای اندازه‌ی بچ: محاسبه‌ی مقدار هر انتقال بر مبنای اندازه‌ی بچ…', 'CalcEngine', 'M', 'VeryComplex'],
      ['F-PC-023', 'PC-FED-004', 'فراخوان مجدد خودکار انبار پای کار هنگام رسیدن موجودی به آستانه', 'CalcEngine', 'M', 'VeryComplex'],
      ['F-PC-024', 'PC-FED-005', 'تخصیص و رزرو موجودی بر مبنای سیاست FEFO/FIFO/عیار/بچ مشخص', 'BasicForm', 'M', 'Simple'],
      ['F-PC-025', 'PC-FED-006', 'محاسبه‌ی مقدار تحویل بر مبنای عیار/خلوص بچ تخصیص‌یافته', 'CalcEngine', 'M', 'Complex'],
      ['F-PC-026', 'PC-FED-007', 'ثبت درخواست کالای مازاد', 'PlatformInfra', 'M', 'Medium'],
      ['F-PC-027', 'PC-FED-008', 'برگشت مازاد از پای کار به انبار در پایان دستور/شیفت با سند خودکار', 'BasicForm', 'M', 'Medium'],
      ['F-PC-028', 'PC-FED-009', 'نمایش موجودی لحظه‌ای انبار پای کار به تفکیک دستور و قلم', 'BasicForm', 'M', 'Simple'],
      ['F-PC-029', 'PC-FED-010', 'جایگزینی قلم در زمان تغذیه بر مبنای گروه جایگزین (PE-SUB)', 'BasicForm', 'M', 'Simple'],
      ['F-PC-030', 'PC-FED-011', 'پشتیبانی بارکد/QR/RFID در تحویل و مصرف پای کار', 'BasicForm', 'M', 'Simple'],
    ]),
  },
  {
    code: 'FRM-PC-04',
    title: 'گزارش تولید',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('گزارش عملیات · مقادیر تولید و ضایعات · کارکرد منابع · گزارش شیفت · تسهیم اپراتور · پیش‌بینی تکمیل'),
    features: buildFeatures([
      ['F-PC-031', 'PC-EXE-001', 'ثبت گزارش تولید در سطح عملیات (نه فقط سطح دستور)', 'ReportDashboard', 'M', 'Simple'],
      ['F-PC-032', 'PC-EXE-002', 'ثبت شروع/توقف/ازسرگیری/پایان عملیات با مهر زمانی، و محاسبه‌ی خودکار کارکرد', 'CalcEngine', 'M', 'VeryComplex'],
      ['F-PC-033', 'PC-EXE-003', 'ثبت مقدار تولیدشده، مقدار ضایعات، مقدار نیازمند دوباره‌کاری، به تفکیک علت', 'BasicForm', 'M', 'Simple'],
      ['F-PC-034', 'PC-EXE-004', 'ثبت کارکرد منابع', 'BasicForm', 'M', 'Simple'],
      ['F-PC-041', 'PC-EXE-011', 'ثبت گزارش شیفت و تحویل و تحول شیفت', 'ReportDashboard', 'M', 'Simple'],
      ['F-PC-042', 'PC-EXE-012', 'ثبت هم‌زمان یک اپراتور روی چند دستور/چند دستگاه با تسهیم کارکرد', 'BasicForm', 'S', 'Medium'],
      ['F-PC-043', 'PC-EXE-013', 'نمایش پیش‌بینی زمان و مقدار تکمیل بر مبنای نرخ واقعی جاری، و هشدار ریسک عدم تحقق', 'BasicForm', 'S', 'Simple'],
    ]),
  },
  {
    code: 'FRM-PC-05',
    title: 'ترمینال کف کارگاه',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('کارتابل اپراتور · شروع و پایان عملیات · ثبت توقف · ثبت ضایعات · پارامترهای فرایندی · دستورالعمل و چک‌لیست · داده‌ی دستگاه'),
    features: buildFeatures([
      ['F-PC-035', 'PC-EXE-005', 'ثبت توقفات با درخت علل', 'BasicForm', 'M', 'Simple'],
      ['F-PC-036', 'PC-EXE-006', 'ثبت پارامترهای فرایندی', 'BasicForm', 'M', 'Simple'],
      ['F-PC-037', 'PC-EXE-007', 'نمایش دستورالعمل کار و چک‌لیست در ترمینال و ثبت اجرای آن', 'SpecializedUI', 'M', 'Complex'],
      ['F-PC-038', 'PC-EXE-008', 'دریافت داده از PLC/SCADA/MES: مواد مصرفی، تعداد تولید، ساعت کارکرد، توقف، پارامتر فرایند', 'ServiceIntegration', 'M', 'VeryComplex'],
      ['F-PC-039', 'PC-EXE-009', 'نمایش انحراف لحظه‌ای داده‌ی دستگاه از ورودی کاربر و الزام توضیح در صورت اختلاف بیش از آستانه', 'BasicForm', 'S', 'Simple'],
      ['F-PC-040', 'PC-EXE-010', 'ترمینال کف کارگاه', 'SpecializedUI', 'M', 'VeryComplex'],
      ['F-PC-070', 'PC-SCR-002', 'ثبت ضایعات در سطح عملیات با علت درختی و تفکیک ضایعات مواد از ضایعات محصول', 'BasicForm', 'M', 'Simple'],
      ['F-PC-071', 'PC-SCR-003', 'تفکیک ضایعات راه‌اندازی از ضایعات فرایند', 'BasicForm', 'M', 'Simple'],
    ]),
  },
  {
    code: 'FRM-PC-06',
    title: 'مصرف مواد',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('مصرف دستی · Backflush · مصرف ترکیبی · تصحیح عیار · ماده‌ی بازیابی‌شده · مواد امانی مشتری · انحراف مصرف'),
    features: buildFeatures([
      ['F-PC-044', 'PC-CON-001', 'ثبت مصرف واقعی دستی در سطح دستور و عملیات', 'BasicForm', 'M', 'Simple'],
      ['F-PC-045', 'PC-CON-002', 'Backflush: تولید خودکار مصرف بر مبنای مقدار تولیدشده و ساختار محصول', 'CalcEngine', 'M', 'VeryComplex'],
      ['F-PC-046', 'PC-CON-003', 'Backflush در دو حالت', 'CalcEngine', 'M', 'Complex'],
      ['F-PC-047', 'PC-CON-004', 'رفتار قابل پیکربندی در صورت کسری موجودی هنگام Backflush', 'CalcEngine', 'M', 'Complex'],
      ['F-PC-048', 'PC-CON-005', 'اصلاح Backflush (Reversal) پس از تصحیح مقدار تولید', 'CalcEngine', 'M', 'VeryComplex'],
      ['F-PC-049', 'PC-CON-006', 'مصرف ترکیبی: بخشی از اقلام Backflush، بخشی دستی', 'CalcEngine', 'M', 'Complex'],
      ['F-PC-050', 'PC-CON-007', 'محاسبه‌ی انحراف مصرف', 'CalcEngine', 'M', 'Complex'],
      ['F-PC-051', 'PC-CON-008', 'ثبت مصرف با تصحیح عیار', 'BasicForm', 'M', 'Simple'],
      ['F-PC-052', 'PC-CON-009', 'صدور رویداد مصرف به سیستم انبار با الگوی سند تعیین‌شده در نسخه‌ی تولید', 'ServiceIntegration', 'M', 'Complex'],
      ['F-PC-053', 'PC-CON-009-A', 'ثبت مصرف ترکیبی ماده‌ی نو و ماده‌ی بازیابی‌شده در یک ردیف فرمول', 'BasicForm', 'M', 'Medium'],
      ['F-PC-054', 'PC-CON-009-B', 'تخصیص بچ ماده‌ی بازیابی‌شده با کنترل خلوص، تاریخ اعتبار و تعداد چرخه‌های بازیابی طی‌شده', 'BasicForm', 'M', 'Simple'],
      ['F-PC-055', 'PC-CON-010', 'ثبت مصرف مواد امانی مشتری', 'BasicForm', 'M', 'Simple'],
    ]),
  },
  {
    code: 'FRM-PC-07',
    title: 'رسید محصول و هویت‌بخشی',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('رسید محصول · هم‌زاد و جانبی · رسید جزئی · بچ محصول · سریال · شجره‌نامه · برچسب · مغایرت‌گیری'),
    features: buildFeatures([
      ['F-PC-056', 'PC-RCV-001', 'رسید محصول بر مبنای سیاست تعیین‌شده', 'BasicForm', 'M', 'Simple'],
      ['F-PC-057', 'PC-RCV-002', 'رسید محصولات هم‌زاد با سهم‌بری تعیین‌شده و محصولات جانبی با ارزش‌گذاری مستقل', 'BasicForm', 'M', 'Simple'],
      ['F-PC-058', 'PC-RCV-003', 'رسید تنها به میزان تاییدشده‌ی کنترل کیفیت', 'BasicForm', 'M', 'Simple'],
      ['F-PC-059', 'PC-RCV-004', 'رسید جزئی و چندمرحله‌ای برای یک دستور', 'BasicForm', 'M', 'Simple'],
      ['F-PC-060', 'PC-RCV-005', 'ثبت و تخصیص بچ محصول با تکمیل تدریجی ویژگی‌ها در مراحل تولید', 'BasicForm', 'M', 'Simple'],
      ['F-PC-061', 'PC-RCV-006', 'تولید و تخصیص سریال', 'CalcEngine', 'M', 'VeryComplex'],
      ['F-PC-062', 'PC-RCV-007', 'ثبت رابطه‌ی بچ به بچ (Genealogy): کدام بچ ماده در کدام بچ محصول مصرف شد', 'BasicForm', 'M', 'Simple'],
      ['F-PC-063', 'PC-RCV-008', 'چاپ برچسب محصول/بچ/سریال با الگوی قابل طراحی و بارکد', 'BasicForm', 'M', 'Simple'],
      ['F-PC-064', 'PC-RCV-009', 'مغایرت‌گیری خودکار بین گزارش تولید و رسید انبار', 'ReportDashboard', 'M', 'Medium'],
    ]),
  },
  {
    code: 'FRM-PC-08',
    title: 'بازیابی مواد در اجرا',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('رسید ماده‌ی بازیابی · نرخ واقعی · موازنه‌ی ماده · موازنه‌ی جرم پیوسته'),
    features: buildFeatures([
      ['F-PC-065', 'PC-RCV-009-A', 'رسید ماده‌ی بازیابی‌شده به‌عنوان خروجی رسمی دستور کار', 'BasicForm', 'M', 'Simple'],
      ['F-PC-066', 'PC-RCV-009-B', 'ثبت نرخ بازیابی واقعی و مقایسه با استاندارد', 'BasicForm', 'M', 'Simple'],
      ['F-PC-067', 'PC-RCV-009-C', 'موازنه‌ی ماده', 'CalcEngine', 'M', 'VeryComplex'],
      ['F-PC-068', 'PC-RCV-010', 'کنترل موازنه‌ی جرم در پروفایل پیوسته', 'CalcEngine', 'S', 'VeryComplex'],
    ]),
  },
  {
    code: 'FRM-PC-09',
    title: 'ضایعات، دوباره‌کاری و بازیافت',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('تعیین تکلیف نامنطبق · دستور دوباره‌کاری · دستور بازیافت · گزارش اجرا · درجه‌بندی مجدد · ضایعات پیمانکار · تحلیل COPQ'),
    features: buildFeatures([
      ['F-PC-069', 'PC-SCR-001', 'تفکیک صریح انواع خروجی نامنطبق', 'BasicForm', 'M', 'Medium'],
      ['F-PC-072', 'PC-SCR-004', 'صدور دستور دوباره‌کاری بر مبنای دستور اصلی یا بدون مبنا', 'BasicForm', 'M', 'Simple'],
      ['F-PC-073', 'PC-SCR-005', 'صدور دستور بازیافت و ارتباط صریح آن با دستور مبدا', 'BasicForm', 'M', 'Medium'],
      ['F-PC-074', 'PC-SCR-006', 'بازگشت ماده‌ی بازیافتی به فرمول به‌عنوان قلم مصرفی', 'BasicForm', 'M', 'Simple'],
      ['F-PC-075', 'PC-SCR-007', 'ثبت گزارش دوباره‌کاری و بازیافت با فیلدهای متناظر گزارش تولید', 'ReportDashboard', 'M', 'Simple'],
      ['F-PC-076', 'PC-SCR-008', 'درجه‌بندی مجدد', 'BasicForm', 'S', 'Simple'],
      ['F-PC-077', 'PC-SCR-009', 'ثبت ضایعات نزد پیمانکار و تعیین تکلیف آن', 'BasicForm', 'M', 'Simple'],
      ['F-PC-078', 'PC-SCR-010', 'ردیابی زنجیره‌ی دوباره‌کاری چندباره‌ی یک بچ و هشدار در صورت تجاوز از حد مجاز', 'BasicForm', 'S', 'Simple'],
      ['F-PC-079', 'PC-SCR-011', 'محاسبه و نمایش هزینه‌ی کیفیت پایین', 'CalcEngine', 'C', 'Medium'],
    ]),
  },
  {
    code: 'FRM-PC-10',
    title: 'اجرای برون‌سپاری و کارمزدی',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('دستور برون‌سپاری · ارسال مواد امانی · دریافت از پیمانکار · مغایرت‌گیری · کارمزد · کارمزدی دریافتی · تفکیک مالکیت'),
    features: buildFeatures([
      ['F-PC-080', 'PC-OUT-001', 'صدور دستور کار دارای عملیات برون‌سپاری با تولید خودکار نیاز خدمت در تدارکات', 'CalcEngine', 'M', 'VeryComplex'],
      ['F-PC-081', 'PC-OUT-002', 'ارسال مواد امانی به پیمانکار با سند انتقال به انبار امانی و برگه‌ی همراه', 'BasicForm', 'M', 'Simple'],
      ['F-PC-082', 'PC-OUT-003', 'دریافت خروجی از پیمانکار', 'BasicForm', 'M', 'Simple'],
      ['F-PC-083', 'PC-OUT-004', 'مغایرت‌گیری مواد ارسالی در برابر مصرف اعلامی + ضایعات + برگشتی', 'BasicForm', 'M', 'Simple'],
      ['F-PC-084', 'PC-OUT-005', 'ادامه‌ی خودکار مسیر تولید داخلی پس از دریافت از پیمانکار', 'BasicForm', 'M', 'Medium'],
      ['F-PC-085', 'PC-OUT-006', 'محاسبه‌ی کارمزد پرداختنی بر مبنای مقدار پذیرفته‌شده و نرخ قرارداد', 'CalcEngine', 'M', 'Complex'],
      ['F-PC-086', 'PC-OUT-007', 'پایش وضعیت کار نزد پیمانکار', 'BasicForm', 'M', 'Simple'],
      ['F-PC-087', 'PC-OUT-008', 'کارمزدی دریافتی', 'CalcEngine', 'M', 'VeryComplex'],
      ['F-PC-088', 'PC-OUT-009', 'صورت‌حساب مصرف مواد مشتری در پایان دوره و تعیین تکلیف مازاد/ضایعات', 'BasicForm', 'M', 'Simple'],
      ['F-PC-089', 'PC-OUT-010', 'جداسازی کامل موجودی مالکیت مشتری از موجودی خودمان در همه‌ی گزارش‌ها', 'ReportDashboard', 'M', 'Simple'],
    ]),
  },
  {
    code: 'FRM-PC-11',
    title: 'پورتال پیمانکار و مشتری کارمزدی',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('سفارش‌های من · ثبت پیشرفت · ارسال و دریافت · مانده‌ی مواد امانی'),
    features: buildFeatures([
      ['F-PC-090', 'PC-OUT-011', 'دسترسی محدود پیمانکار/مشتری کارمزدی به پورتال جهت مشاهده و ثبت پیشرفت', 'PlatformInfra', 'C', 'Simple'],
    ]),
  },
  {
    code: 'FRM-PC-12',
    title: 'کنسول پایش و بستن دستور',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('داشبورد لحظه‌ای · استثناها و هشدارها · علت انحراف · کار در جریان · بستن دستور · آندون'),
    features: buildFeatures([
      ['F-PC-091', 'PC-MON-001', 'داشبورد لحظه‌ای تولید', 'ReportDashboard', 'M', 'Simple'],
      ['F-PC-092', 'PC-MON-002', 'موتور استثنا', 'CalcEngine', 'M', 'VeryComplex'],
      ['F-PC-093', 'PC-MON-003', 'تشدید خودکار', 'CalcEngine', 'S', 'VeryComplex'],
      ['F-PC-094', 'PC-MON-004', 'ثبت علت انحراف از برنامه با درخت علل و اتصال به اقدام اصلاحی', 'ServiceIntegration', 'M', 'Complex'],
      ['F-PC-095', 'PC-MON-005', 'نمای آندون (Andon) برای نمایش وضعیت خط روی مانیتور کارگاه', 'ReportDashboard', 'S', 'Simple'],
      ['F-PC-096', 'PC-MON-006', 'بستن دستور کار با کنترل', 'BasicForm', 'M', 'Simple'],
      ['F-PC-097', 'PC-MON-007', 'بستن خودکار دستورهای معلق پس از بازه‌ی تعیین‌شده با گزارش موارد بازمانده', 'ReportDashboard', 'S', 'Medium'],
      ['F-PC-098', 'PC-MON-008', 'محاسبه و نمایش کار در جریان', 'CalcEngine', 'M', 'Complex'],
      ['F-PC-099', 'PC-MON-009', 'ارسال رویداد بستن دستور به بهای تمام‌شده برای تسویه', 'ServiceIntegration', 'M', 'Complex'],
      ['F-PC-100', 'PC-MON-010', 'بازگشایی دستور بسته‌شده با گردش تایید و ثبت دلیل', 'PlatformInfra', 'S', 'Medium'],
    ]),
  },
];
