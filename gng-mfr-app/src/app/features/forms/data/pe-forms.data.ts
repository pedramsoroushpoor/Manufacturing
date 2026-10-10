import { FeatureArtifactType, FeatureComplexity, FeaturePriority, FormShellConfig } from '../../../core/models/form-shell.model';

/**
 * داده‌ی فرم‌های حوزه‌ی «مهندسی محصول» (PE) — عیناً برگرفته از:
 * alm.Form (WHERE AnalysisDocumentCode = 'ALM-DOC-PE')
 * alm.FormFeatureMapping ⨝ alm.Feature (WHERE FormCode LIKE 'FRM-PE-%')
 * alm.Menu (WHERE SubSystemCode='mes' AND ParentCode='430')
 *
 * هر تاپل فیچر: [Code, Requirement, Title, ArtifactType, Priority, Complexity]
 */
type FeatureTuple = [string, string, string, FeatureArtifactType, FeaturePriority, FeatureComplexity];

const DOMAIN_TITLE = 'مهندسی محصول';
const DOMAIN_CODE = 'PE';

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

export const PE_FORMS: FormShellConfig[] = [
  {
    code: 'FRM-PE-01',
    title: 'ویژگی‌های تولیدی قلم',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('نقش تولیدی · سیاست تامین · هویت و ردیابی · ویژگی‌های تولیدی · فانتوم · ابعاد · پیکربندی‌پذیری · اندازه‌ی بسته'),
    features: buildFeatures([
      ['F-PE-001', 'PE-ITM-001', 'افزودن نقش تولیدی به کالای موجود در کاتالوگ انبار', 'BasicForm', 'M', 'Simple'],
      ['F-PE-002', 'PE-ITM-002', 'تعیین سیاست تامین: تولید داخلی / خرید / برون‌سپاری / انتقال بین‌سایتی', 'BasicForm', 'M', 'Simple'],
      ['F-PE-003', 'PE-ITM-003', 'تعیین سطح هویت‌بخشی: بدون ردیابی، بچ، سریال، بچ+سریال', 'BasicForm', 'M', 'Simple'],
      ['F-PE-004', 'PE-ITM-004', 'تعریف ویژگی‌های تولیدی قابل‌گسترش', 'BasicForm', 'M', 'Simple'],
      ['F-PE-005', 'PE-ITM-005', 'تعریف قلم فانتوم: در محاسبات، جای خود را به اجزایش می‌دهد و در ساختار دیده نمی‌شود', 'BasicForm', 'M', 'Medium'],
      ['F-PE-006', 'PE-ITM-006', 'تعریف اقلام ابعادی', 'CalcEngine', 'M', 'VeryComplex'],
      ['F-PE-007', 'PE-ITM-007', 'تعریف قلم پیکربندی‌پذیر با فهرست ویژگی‌های انتخابی و مقادیر مجاز', 'BasicForm', 'S', 'Medium'],
      ['F-PE-008', 'PE-ITM-008', 'تعریف اندازه‌ی بسته، حداقل و مضرب سفارش تولید به‌ازای قلم و خط', 'BasicForm', 'M', 'Simple'],
    ]),
  },
  {
    code: 'FRM-PE-02',
    title: 'ساختار محصول',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('اطلاعات کلی · ردیف‌های مصرفی · نسخه و اعتبار · مدارک و پیوست'),
    features: buildFeatures([
      ['F-PE-009', 'PE-BOM-001', 'تعریف ساختار محصول با قالب', 'BasicForm', 'M', 'Simple'],
      ['F-PE-010', 'PE-BOM-002', 'تعریف چند ساختار برای یک محصول', 'BasicForm', 'M', 'Simple'],
      ['F-PE-011', 'PE-BOM-003', 'تعیین دامنه‌ی اعتبار سازمانی (شرکت/شعبه/کارخانه/خط) مطابق PF-20', 'PlatformInfra', 'M', 'Medium'],
      ['F-PE-012', 'PE-BOM-004', 'تعیین اندازه‌ی مرجع', 'BasicForm', 'M', 'Simple'],
      ['F-PE-013', 'PE-BOM-005', 'تعیین نوع ساختار (تولیدی، آزمایشی/R&D، الگو، نمونه‌سازی، مهندسی) و گردش کار تبدیل بین انواع', 'PlatformInfra', 'M', 'Complex'],
      ['F-PE-014', 'PE-BOM-006', 'تعریف ساختار به‌عنوان الگو و ارث‌بری از آن با امکان بازنویسی ردیف‌ها', 'BasicForm', 'M', 'Simple'],
      ['F-PE-015', 'PE-BOM-007', 'ورژنینگ و اعتبار زمانی/بچ‌محور/سفارش‌محور', 'BasicForm', 'M', 'Simple'],
      ['F-PE-016', 'PE-BOM-008', 'کپی ساختار برای ایجاد ساختار جدید', 'BasicForm', 'M', 'Simple'],
      ['F-PE-017', 'PE-BOM-009', 'مقایسه‌ی دو ساختار یا دو نسخه', 'BasicForm', 'M', 'Simple'],
      ['F-PE-018', 'PE-BOM-010', 'ثبت مستندات پیوست', 'PlatformInfra', 'M', 'Medium'],
      ['F-PE-019', 'PE-CMP-001', 'ثبت مقدار به‌صورت ثابت، متناسب با مقدار تولید، یا فرمول محاسباتی', 'BasicForm', 'M', 'Medium'],
      ['F-PE-020', 'PE-CMP-002', 'ثبت مقدار درصدی با کنترل جمع ۱۰۰٪ و هشدار بصری در صورت انحراف', 'BasicForm', 'M', 'Simple'],
      ['F-PE-021', 'PE-CMP-003', 'ضایعات مصرف در سطح ردیف', 'BasicForm', 'M', 'Simple'],
      ['F-PE-022', 'PE-CMP-004', 'تعیین محدوده‌ی مجاز مصرف', 'ReportDashboard', 'M', 'Simple'],
      ['F-PE-023', 'PE-CMP-005', 'تعیین قلم مصرفی بر مبنای عیار/خلوص', 'BasicForm', 'M', 'Simple'],
      ['F-PE-024', 'PE-CMP-006', 'مصرف بر مبنای واحد متفاوت با واحد انبار', 'BasicForm', 'M', 'Simple'],
      ['F-PE-025', 'PE-CMP-007', 'تعیین قلم به‌عنوان اختیاری یا مشروط', 'BasicForm', 'S', 'Simple'],
      ['F-PE-026', 'PE-CMP-008', 'ثبت مصرف منفی', 'BasicForm', 'S', 'Simple'],
      ['F-PE-068', 'PE-CAL-007', 'خروجی ساختار به اکسل و ورود گروهی از اکسل با اعتبارسنجی سطری', 'BasicForm', 'M', 'Simple'],
    ]),
  },
  {
    code: 'FRM-PE-03',
    title: 'گروه جایگزین و سیاست جایگزینی',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('گروه جایگزین · اقلام و نسبت تبدیل · اولویت · سیاست ترکیبی · محدوده‌ی مجاز · الزام تایید کیفی'),
    features: buildFeatures([
      ['F-PE-027', 'PE-SUB-001', 'تعریف گروه جایگزین به‌عنوان موجودیت مستقل و قابل استفاده در چند ساختار', 'BasicForm', 'M', 'Simple'],
      ['F-PE-028', 'PE-SUB-002', 'جایگزینی چند به چند', 'BasicForm', 'M', 'Simple'],
      ['F-PE-029', 'PE-SUB-003', 'تعیین اولویت مصرف در گروه جایگزین', 'BasicForm', 'M', 'Simple'],
      ['F-PE-030', 'PE-SUB-004', 'سیاست جایگزینی ترکیبی / غیرترکیبی', 'BasicForm', 'M', 'Simple'],
      ['F-PE-031', 'PE-SUB-005', 'جایگزینی خودکار بر مبنای موجودی', 'BasicForm', 'S', 'Medium'],
      ['F-PE-032', 'PE-SUB-006', 'محدوده‌ی درصد مجاز جایگزینی', 'BasicForm', 'S', 'Simple'],
      ['F-PE-033', 'PE-SUB-007', 'ثبت الزام تایید کیفی برای فعال‌شدن جایگزینی در یک بچ خاص', 'BasicForm', 'S', 'Simple'],
    ]),
  },
  {
    code: 'FRM-PE-04',
    title: 'خروجی‌های ساختار و بازدهی',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('محصول هم‌زاد · محصول جانبی · ضایعات مورد انتظار · جدول بازدهی · انبار پیش‌فرض'),
    features: buildFeatures([
      ['F-PE-034', 'PE-OUT-001', 'تعیین چند محصول هم‌زاد (Co-Product) برای یک ساختار', 'BasicForm', 'M', 'Simple'],
      ['F-PE-035', 'PE-OUT-002', 'تعیین محصول جانبی', 'BasicForm', 'M', 'Simple'],
      ['F-PE-036', 'PE-OUT-003', 'تعیین فرایند حصول هر خروجی', 'BasicForm', 'M', 'Simple'],
      ['F-PE-037', 'PE-OUT-004', 'جدول بازدهی (Yield) برای پروفایل پیوسته', 'CalcEngine', 'M', 'VeryComplex'],
      ['F-PE-038', 'PE-OUT-005', 'تعیین بازدهی وابسته به کیفیت خوراک (عیار ورودی ← درصد بازیابی)', 'BasicForm', 'S', 'Simple'],
      ['F-PE-039', 'PE-OUT-006', 'ثبت ضایعات مورد انتظار به‌عنوان خروجی صریح ساختار', 'BasicForm', 'M', 'Medium'],
      ['F-PE-040', 'PE-OUT-007', 'تخصیص انبار پیش‌فرض رسید هر خروجی', 'BasicForm', 'M', 'Simple'],
    ]),
  },
  {
    code: 'FRM-PE-05',
    title: 'بازیابی مواد در فرایند',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('ماده‌ی بازیابی‌شده · نرخ و تلفات بازیابی · درصد مجاز در فرمول · نسبت جایگزینی · کنترل کیفی و سقف چرخه · بازیابی متقاطع · ارزش‌گذاری'),
    features: buildFeatures([
      ['F-PE-041', 'PE-RCV-001', 'تعریف ماده‌ی بازیابی‌شده به‌عنوان قلم مستقل یا به‌عنوان گرید کیفی متمایز از همان قلم', 'BasicForm', 'M', 'Medium'],
      ['F-PE-042', 'PE-RCV-002', 'تعیین نرخ بازیابی استاندارد', 'BasicForm', 'M', 'Medium'],
      ['F-PE-043', 'PE-RCV-003', 'تعیین درصد مجاز استفاده از ماده‌ی بازیابی‌شده در هر ردیف فرمول', 'BasicForm', 'M', 'Medium'],
      ['F-PE-044', 'PE-RCV-004', 'تعیین نسبت جایگزینی ماده‌ی بازیابی‌شده با ماده‌ی نو بر مبنای خلوص یا عیار (PF-81)', 'BasicForm', 'M', 'Medium'],
      ['F-PE-045', 'PE-RCV-005', 'تعیین حداقل خلوص قابل قبول برای مصرف ماده‌ی بازیابی‌شده و الزام تایید کیفی پیش از مصرف', 'BasicForm', 'M', 'Simple'],
      ['F-PE-046', 'PE-RCV-006', 'تعیین سقف دفعات بازیابی یک ماده و شمارش تجمعی چرخه‌های بازیابی روی هر بچ', 'BasicForm', 'M', 'Simple'],
      ['F-PE-047', 'PE-RCV-007', 'تعریف ماده‌ی بازیابی‌شده به‌عنوان خروجی صریح ساختار محصول', 'BasicForm', 'M', 'Medium'],
      ['F-PE-048', 'PE-RCV-008', 'تعیین تلفات بازیابی: درصد ماده‌ای که در فرایند بازیابی از دست می‌رود (تبخیر، ته‌مانده)', 'CalcEngine', 'M', 'VeryComplex'],
      ['F-PE-049', 'PE-RCV-009', 'امکان مصرف ماده‌ی بازیابی‌شده در محصولی غیر از محصول مبدا (بازیابی متقاطع)', 'BasicForm', 'S', 'Simple'],
      ['F-PE-050', 'PE-RCV-010', 'تعیین اولویت مصرف: ابتدا بازیابی‌شده تا سقف مجاز، سپس نو', 'BasicForm', 'M', 'Simple'],
      ['F-PE-051', 'PE-RCV-011', 'ارزش‌گذاری ماده‌ی بازیابی‌شده به‌عنوان ورودی سیستم بهای تمام‌شده', 'BasicForm', 'S', 'Simple'],
    ]),
  },
  {
    code: 'FRM-PE-06',
    title: 'ساختار ماتریسی و اقلام ابعادی',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('مدل پایه · ماتریس ابعاد · جدول یا فرمول مصرف · اقلام مستقل از ابعاد · مارکر برش'),
    features: buildFeatures([
      ['F-PE-052', 'PE-MTX-001', 'تعریف ساختار در سطح مدل پایه و اشتقاق خودکار ساختار هر ترکیب سایز/رنگ', 'BasicForm', 'M', 'Medium'],
      ['F-PE-053', 'PE-MTX-002', 'تعیین مقدار مصرف به‌صورت جدول ابعادی', 'BasicForm', 'M', 'Simple'],
      ['F-PE-054', 'PE-MTX-003', 'ثبت مصرف بر مبنای مارکر/الگوی برش', 'BasicForm', 'S', 'Simple'],
      ['F-PE-055', 'PE-MTX-004', 'ثبت اقلام مستقل از ابعاد', 'BasicForm', 'M', 'Simple'],
      ['F-PE-056', 'PE-MTX-005', 'ورود گروهی ماتریس از اکسل و ویرایش ماتریسی در فرم', 'SpecializedUI', 'M', 'VeryComplex'],
    ]),
  },
  {
    code: 'FRM-PE-07',
    title: 'پیکربندی محصول',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('ویژگی‌ها و مقادیر · قواعد سازگاری · شرط ردیف‌ها · ساختار مؤثر'),
    features: buildFeatures([
      ['F-PE-057', 'PE-CFG-001', 'تعریف مدل پیکربندی', 'BasicForm', 'S', 'Simple'],
      ['F-PE-058', 'PE-CFG-002', 'تعریف قواعد سازگاری', 'BasicForm', 'S', 'Simple'],
      ['F-PE-059', 'PE-CFG-003', 'شرط‌گذاری ردیف‌های ساختار بر مبنای انتخاب‌ها', 'BasicForm', 'S', 'Simple'],
      ['F-PE-060', 'PE-CFG-004', 'تولید ساختار مؤثر', 'BasicForm', 'S', 'Simple'],
      ['F-PE-061', 'PE-CFG-005', 'نگهداری پیکربندی انتخاب‌شده روی سفارش و بچ/سریال تولیدشده', 'BasicForm', 'S', 'Simple'],
    ]),
  },
  {
    code: 'FRM-PE-08',
    title: 'نماها و محاسبات ساختار',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('درخت‌واره‌ی چندسطحی · بسط ساختار · کاربرد معکوس · خواص تجمعی · شبیه‌ساز تغییر ماده'),
    features: buildFeatures([
      ['F-PE-062', 'PE-CAL-001', 'نمایش درختی چندسطحی ساختار تا آخرین لایه، با نمایش فانتوم‌ها به‌صورت شفاف', 'ReportDashboard', 'M', 'Complex'],
      ['F-PE-063', 'PE-CAL-002', 'بسط ساختار (BOM Explosion)', 'CalcEngine', 'M', 'VeryComplex'],
      ['F-PE-064', 'PE-CAL-003', 'کاربرد معکوس (Where-Used)', 'BasicForm', 'M', 'Medium'],
      ['F-PE-065', 'PE-CAL-004', 'محاسبه‌ی خواص تجمعی محصول از روی اجزا', 'CalcEngine', 'S', 'Complex'],
      ['F-PE-066', 'PE-CAL-005', 'تشخیص حلقه‌ی بازگشتی در ساختار و منع ثبت آن', 'BasicForm', 'M', 'Simple'],
      ['F-PE-067', 'PE-CAL-006', 'شبیه‌سازی «اگر این ماده حذف/جایگزین شود چه محصولاتی و چه سفارش‌هایی متاثر می‌شوند»', 'CalcEngine', 'S', 'VeryComplex'],
    ]),
  },
  {
    code: 'FRM-PE-09',
    title: 'مدیریت تغییر مهندسی (ECO)',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('درخواست تغییر · دامنه‌ی چندموجودیتی · تحلیل اثر · سیاست موجودی · تایید و امضا'),
    features: buildFeatures([
      ['F-PE-069', 'PE-ECO-001', 'ثبت درخواست تغییر با منشأ', 'BasicForm', 'M', 'Simple'],
      ['F-PE-070', 'PE-ECO-002', 'گزارش تحلیل اثر پیش از تایید', 'ReportDashboard', 'M', 'Medium'],
      ['F-PE-071', 'PE-ECO-003', 'تعیین سیاست موجودی موجود', 'BasicForm', 'M', 'Simple'],
      ['F-PE-072', 'PE-ECO-004', 'فعال‌سازی هم‌زمان و اتمیک همه‌ی تغییرات یک ECO در تاریخ اثر', 'BasicForm', 'S', 'Medium'],
      ['F-PE-073', 'PE-ECO-005', 'اطلاع‌رسانی خودکار به واحدهای متاثر', 'BasicForm', 'M', 'Medium'],
      ['F-PE-074', 'PE-ECO-006', 'امضای الکترونیک تاییدکنندگان با احراز مجدد', 'PlatformInfra', 'M', 'Medium'],
    ]),
  },
];
