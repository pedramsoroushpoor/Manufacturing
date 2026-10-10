import { FeatureArtifactType, FeatureComplexity, FeaturePriority, FormShellConfig } from '../../../core/models/form-shell.model';

/**
 * داده‌ی فرم‌های حوزه‌ی «چارچوب مشترک» (PF) — عیناً برگرفته از:
 * alm.Form (WHERE AnalysisDocumentCode = 'ALM-DOC-PF')
 * alm.FormFeatureMapping ⨝ alm.Feature (WHERE FormCode LIKE 'FRM-PF-%')
 * alm.Menu (WHERE SubSystemCode='mes' AND ParentCode='410')
 *
 * هر تاپل فیچر: [Code, Requirement, Title, ArtifactType, Priority, Complexity]
 */
type FeatureTuple = [string, string, string, FeatureArtifactType, FeaturePriority, FeatureComplexity];

const DOMAIN_TITLE = 'چارچوب مشترک';
const DOMAIN_CODE = 'PF';

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

export const PF_FORMS: FormShellConfig[] = [
  {
    code: 'FRM-PF-01',
    title: 'کنسول پیکربندی پلتفرم',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('پروفایل صنعت · ابعاد و بازنویسی پروفایل · سطوح سازمانی و ارث‌بری · واحد سنجش و تبدیل · عیار و گِردکردن · موازنه‌ی جرم و انرژی · تقویم و زبان'),
    features: buildFeatures([
      ['F-PF-004', 'PF-10', 'کاربر می‌تواند در سطح شرکت/کارخانه/خط تولید یک پروفایل انتخاب و سپس تک‌تک ابعاد آن را بازنویسی', 'BasicForm', 'M', 'Simple'],
      ['F-PF-005', 'PF-11', 'رفتار فرم‌ها', 'PlatformInfra', 'M', 'Complex'],
      ['F-PF-006', 'PF-12', 'امکان تعریف پروفایل سفارشی توسط شریک استقرار و صادرات/واردات آن به‌عنوان بسته‌ی پیکربندی', 'BasicForm', 'S', 'Simple'],
      ['F-PF-007', 'PF-13', 'تغییر پروفایل پس از وجود داده‌ی عملیاتی، فقط با گردش تایید و گزارش تحلیل اثر', 'ReportDashboard', 'M', 'Medium'],
      ['F-PF-008', 'PF-20', 'هر موجودیت اطلاعات پایه', 'BasicForm', 'M', 'Medium'],
      ['F-PF-009', 'PF-21', 'قاعده‌ی ارجحیت', 'BasicForm', 'M', 'Medium'],
      ['F-PF-010', 'PF-22', 'نمایش «مقدار مؤثر و منشأ آن» در هر فرم', 'BasicForm', 'M', 'Simple'],
      ['F-PF-011', 'PF-23', 'انبارها و مراکز هزینه از سیستم‌های انبار و مالی فراخوانی می‌شوند، نه بازتعریف', 'BasicForm', 'M', 'Simple'],
      ['F-PF-037', 'PF-80', 'واحد اصلی، واحد فرعی و ضرایب تبدیل ثابت و متغیر (تبدیل وابسته به بچ', 'BasicForm', 'M', 'Medium'],
      ['F-PF-038', 'PF-81', 'درجه خلوص/عیار (Potency)', 'CalcEngine', 'M', 'VeryComplex'],
      ['F-PF-039', 'PF-82', 'سیاست گِردکردن به تفکیک قلم و عملیات', 'BasicForm', 'M', 'Simple'],
      ['F-PF-040', 'PF-83', 'موازنه‌ی جرم/انرژی برای پروفایل‌های پیوسته', 'CalcEngine', 'S', 'VeryComplex'],
      ['F-PF-045', 'PF-94', 'تقویم شمسی و میلادی هم‌زمان در همه‌ی فرم‌های عملیاتی و گزارش‌ها (نه فقط اطلاعات پایه', 'ReportDashboard', 'M', 'Complex'],
      ['F-PF-046', 'PF-95', 'چندزبانه بودن رابط کاربری و داده‌های پایه (نام کالا، عملیات)', 'PlatformInfra', 'S', 'Medium'],
    ]),
  },
  {
    code: 'FRM-PF-02',
    title: 'مدیریت نسخه، اعتبار و تغییر مهندسی',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('تنظیمات نسخه و اعتبار · انواع Effectivity · چارچوب ECO · سیاست موجودی در جریان'),
    features: buildFeatures([
      ['F-PF-012', 'PF-30', 'انواع اعتبار', 'BasicForm', 'M', 'Simple'],
      ['F-PF-013', 'PF-31', 'هیچ نسخه‌ی تاییدشده‌ای ویرایش نمی‌شود', 'BasicForm', 'M', 'Simple'],
      ['F-PF-014', 'PF-32', 'امکان هم‌زیستی چند نسخه‌ی فعال با شرایط اعتبار متفاوت', 'BasicForm', 'M', 'Simple'],
      ['F-PF-015', 'PF-33', 'مقایسه‌ی دو نسخه', 'BasicForm', 'M', 'Simple'],
      ['F-PF-016', 'PF-40', 'تعریف «درخواست تغییر مهندسی» به‌عنوان موجودیت مستقل با', 'PlatformInfra', 'M', 'VeryComplex'],
      ['F-PF-017', 'PF-41', 'تحلیل اثر پیش از تایید', 'CalcEngine', 'M', 'VeryComplex'],
      ['F-PF-018', 'PF-42', 'اجرای هم‌زمان و اتمیک تغییرات یک ECO', 'BasicForm', 'S', 'Medium'],
      ['F-PF-019', 'PF-43', 'سیاست تکلیف موجودی و سفارش‌های در جریان', 'BasicForm', 'S', 'Simple'],
    ]),
  },
  {
    code: 'FRM-PF-03',
    title: 'طراح گردش کار و دسترسی',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('گردش کار · وضعیت‌های سفارشی · شرط مسیر · نقش و دسترسی · دسترسی سطح فیلد · تفویض اختیار'),
    features: buildFeatures([
      ['F-PF-020', 'PF-50', 'موتور گردش کار قابل تعریف روی همه‌ی فرم‌های عملیاتی و اطلاعات پایه', 'CalcEngine', 'M', 'Complex'],
      ['F-PF-021', 'PF-51', 'امکان افزودن وضعیت سفارشی به چرخه‌ی عمر هر فرم', 'BasicForm', 'M', 'Simple'],
      ['F-PF-022', 'PF-52', 'شرط‌گذاری مسیر گردش بر اساس داده‌ی فرم', 'BasicForm', 'M', 'Simple'],
      ['F-PF-023', 'PF-53', 'دسترسی در سه بُعد', 'PlatformInfra', 'M', 'Complex'],
      ['F-PF-024', 'PF-54', 'دسترسی در سطح فیلد', 'PlatformInfra', 'M', 'Medium'],
      ['F-PF-025', 'PF-55', 'تفویض اختیار موقت با بازه‌ی زمانی', 'BasicForm', 'S', 'Simple'],
    ]),
  },
  {
    code: 'FRM-PF-04',
    title: 'استودیوی توسعه‌پذیری',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('فیلد اضافی · موجودیت اضافی · قاعده‌ی کسب‌وکار · الگوی چاپ · پیوست و مدارک · ورود و خروج اکسل'),
    features: buildFeatures([
      ['F-PF-026', 'PF-60', 'فیلد اضافی (Custom Field) روی هر فرم', 'ReportDashboard', 'M', 'Medium'],
      ['F-PF-027', 'PF-61', 'موجودیت اضافی', 'PlatformInfra', 'S', 'Medium'],
      ['F-PF-028', 'PF-62', 'قاعده‌ی کاربرساخته (Business Rule)', 'CalcEngine', 'S', 'Complex'],
      ['F-PF-029', 'PF-63', 'الگوی چاپ قابل طراحی توسط کاربر', 'PlatformInfra', 'S', 'Medium'],
      ['F-PF-030', 'PF-64', 'پیوست فایل با نسخه‌بندی و کنترل دسترسی روی همه‌ی فرم‌ها', 'PlatformInfra', 'M', 'Medium'],
      ['F-PF-035', 'PF-74', 'ورود/خروج اکسل روی همه‌ی فرم‌های اطلاعات پایه و عملیاتی', 'ReportDashboard', 'M', 'Simple'],
    ]),
  },
  {
    code: 'FRM-PF-05',
    title: 'مرکز یکپارچگی',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('قرارداد و API · رویدادها · Webhook · اتصال تجهیزات (PLC/SCADA/MES)'),
    features: buildFeatures([
      ['F-PF-031', 'PF-70', 'هر سیستم مرز خود را با قرارداد صریح', 'ServiceIntegration', 'M', 'Complex'],
      ['F-PF-032', 'PF-71', 'معماری رویدادمحور', 'ServiceIntegration', 'M', 'VeryComplex'],
      ['F-PF-033', 'PF-72', 'API عمومی (REST) برای همه‌ی موجودیت‌های اصلی', 'ServiceIntegration', 'M', 'Complex'],
      ['F-PF-034', 'PF-73', 'لایه‌ی اتصال به تجهیزات', 'ServiceIntegration', 'M', 'VeryComplex'],
      ['F-PF-036', 'PF-75', 'Webhook خروجی برای رویدادها', 'ServiceIntegration', 'S', 'Complex'],
    ]),
  },
  {
    code: 'FRM-PF-06',
    title: 'انطباق و ممیزی',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('لاگ ممیزی · امضای الکترونیک · ALCOA+ و Part 11 · سیاست سند معکوس'),
    features: buildFeatures([
      ['F-PF-041', 'PF-90', 'لاگ ممیزی کامل (Audit Trail) روی همه‌ی موجودیت‌ها', 'PlatformInfra', 'M', 'Complex'],
      ['F-PF-042', 'PF-91', 'امضای الکترونیک با احراز هویت مجدد در نقاط بحرانی', 'ReportDashboard', 'M', 'Simple'],
      ['F-PF-043', 'PF-92', 'انطباق با اصول ALCOA+ و الزامات 21 CFR Part 11 برای پروفایل دارویی', 'BasicForm', 'S', 'Simple'],
      ['F-PF-044', 'PF-93', 'غیرقابل حذف بودن رکوردهای عملیاتی تاییدشده', 'BasicForm', 'M', 'Simple'],
    ]),
  },
  {
    code: 'FRM-PF-07',
    title: 'مدیریت نیازمندی و ماتریس ردیابی',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('نیازمندی · فیچر · فرم · تسک'),
    features: buildFeatures([
      ['F-PF-001', 'PF-01', 'هر نیازمندی کد یکتا و پایدار دارد', 'BasicForm', 'C', 'Simple'],
      ['F-PF-002', 'PF-02', 'هر فیچر دقیقاً به یک یا چند نیازمندی ارجاع دارد', 'BasicForm', 'M', 'Simple'],
      ['F-PF-003', 'PF-03', 'ماتریس ردیابی به‌صورت خودکار از این ارجاعات تولید می‌شود و در هر بازبینی سند به‌روز می‌گردد', 'SpecializedUI', 'M', 'VeryComplex'],
    ]),
  },
];
