import { FeatureArtifactType, FeatureComplexity, FeaturePriority, FormShellConfig } from '../../../core/models/form-shell.model';

/**
 * داده‌ی فرم‌های حوزه‌ی «مدیریت منابع» (RM) — عیناً برگرفته از:
 * alm.Form (WHERE AnalysisDocumentCode = 'ALM-DOC-RM')
 * alm.FormFeatureMapping ⨝ alm.Feature (WHERE FormCode LIKE 'FRM-RM-%')
 * alm.Menu (WHERE SubSystemCode='mes' AND ParentCode='420')
 *
 * هر تاپل فیچر: [Code, Requirement, Title, ArtifactType, Priority, Complexity]
 */
type FeatureTuple = [string, string, string, FeatureArtifactType, FeaturePriority, FeatureComplexity];

const DOMAIN_TITLE = 'مدیریت منابع';
const DOMAIN_CODE = 'RM';

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

export const RM_FORMS: FormShellConfig[] = [
  {
    code: 'FRM-RM-01',
    title: 'ساختار کارخانه و خطوط تولید',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('سلسله‌مراتب سازمانی · خط تولید و توپولوژی · ایستگاه کاری · گروه منبع · منبع سیار · انبار پای کار'),
    features: buildFeatures([
      ['F-RM-001', 'RM-STR-001', 'تعریف سلسله‌مراتب شرکت ← کارخانه ← واحد تولیدی ← خط ← ایستگاه کاری ← موقعیت', 'BasicForm', 'M', 'Simple'],
      ['F-RM-002', 'RM-STR-002', 'تعیین مسئول و جانشین برای هر سطح', 'BasicForm', 'M', 'Simple'],
      ['F-RM-003', 'RM-STR-003', 'تعیین نوع ایستگاه کاری', 'BasicForm', 'M', 'Simple'],
      ['F-RM-004', 'RM-STR-004', 'ارتباط ایستگاه کاری با یک یا چند مرکز هزینه', 'BasicForm', 'M', 'Simple'],
      ['F-RM-005', 'RM-STR-005', 'تعریف توپولوژی خط', 'BasicForm', 'M', 'Simple'],
      ['F-RM-006', 'RM-STR-006', 'ویرایشگر گرافیکی چیدمان خط با امکان درگ‌اند‌دراپ ایستگاه‌ها و اتصال آن‌ها', 'SpecializedUI', 'S', 'VeryComplex'],
      ['F-RM-007', 'RM-STR-007', 'تعریف گروه منبع', 'BasicForm', 'M', 'Simple'],
      ['F-RM-008', 'RM-STR-008', 'تعریف منبع سیار که به ایستگاه ثابت گره نخورده و بین سایت‌ها جابه‌جا می‌شود', 'BasicForm', 'S', 'Simple'],
      ['F-RM-009', 'RM-STR-009', 'تعریف انبار پای کار به‌ازای خط/ایستگاه و ارتباط آن با انبار مرجع در سیستم انبار', 'BasicForm', 'M', 'Simple'],
      ['F-RM-010', 'RM-STR-010', 'فعال/غیرفعال‌سازی ایستگاه با تاریخ اثر، بدون حذف سابقه', 'BasicForm', 'M', 'Simple'],
    ]),
  },
  {
    code: 'FRM-RM-02',
    title: 'تجهیزات، ابزار و قالب',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('تجهیز و سلسله‌مراتب · ویژگی‌های فنی · قابلیت تجهیز · ابزار و قالب · کارکرد تجمعی · ماتریس زمان تعویض · نسخه‌ی برنامه‌ی دستگاه'),
    features: buildFeatures([
      ['F-RM-011', 'RM-EQP-001', 'تعریف تجهیز با سلسله‌مراتب والد/فرزند', 'BasicForm', 'M', 'Simple'],
      ['F-RM-012', 'RM-EQP-002', 'مشخصات فنی تجهیز به‌صورت ویژگی‌های قابل تعریف (نه فیلد ثابت)', 'BasicForm', 'M', 'Simple'],
      ['F-RM-013', 'RM-EQP-003', 'تعریف قابلیت تجهیز (Capability)', 'BasicForm', 'M', 'Simple'],
      ['F-RM-014', 'RM-EQP-004', 'تعریف ابزار/قالب به‌عنوان منبع مستقل با عمر مفید، تعداد ضربه/کارکرد، وضعیت تیزکاری', 'BasicForm', 'M', 'Simple'],
      ['F-RM-015', 'RM-EQP-005', 'الزام حضور ابزار مشخص برای اجرای عملیات', 'BasicForm', 'M', 'Simple'],
      ['F-RM-016', 'RM-EQP-006', 'ثبت کارکرد تجمعی تجهیز/ابزار و ارسال به سیستم نت به‌عنوان محرک نگهداری', 'ServiceIntegration', 'M', 'Complex'],
      ['F-RM-017', 'RM-EQP-007', 'دریافت وضعیت «در دسترس / تحت تعمیر / متوقف» از سیستم نت به‌صورت رویدادی', 'ServiceIntegration', 'M', 'Complex'],
      ['F-RM-018', 'RM-EQP-008', 'ثبت زمان راه‌اندازی و تعویض قالب (Changeover) به‌ازای هر جفت محصول/ابزار', 'BasicForm', 'M', 'Simple'],
      ['F-RM-019', 'RM-EQP-009', 'مدیریت نسخه‌ی نرم‌افزار/برنامه‌ی دستگاه', 'BasicForm', 'C', 'Simple'],
    ]),
  },
  {
    code: 'FRM-RM-03',
    title: 'نیروی کار و ماتریس مهارت',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('پرسنل تولید · مهارت‌ها · ماتریس مهارت · گروه کاری · نرخ و محرک هزینه'),
    features: buildFeatures([
      ['F-RM-020', 'RM-HR-001', 'تعریف پرسنل تولید با فراخوانی از سیستم HR', 'BasicForm', 'M', 'Simple'],
      ['F-RM-021', 'RM-HR-002', 'ماتریس مهارت', 'SpecializedUI', 'M', 'VeryComplex'],
      ['F-RM-022', 'RM-HR-003', 'الزام مهارت برای عملیات', 'BasicForm', 'M', 'Simple'],
      ['F-RM-023', 'RM-HR-004', 'تعریف گروه کاری / تیم و تخصیص گروه به ایستگاه یا خط', 'BasicForm', 'M', 'Simple'],
      ['F-RM-028', 'RM-HR-009', 'تعریف نرخ ساعتی/محرک هزینه‌ی نیروی کار به تفکیک مهارت یا گروه', 'BasicForm', 'S', 'Simple'],
      ['F-RM-029', 'RM-HR-010', 'تعریف نفر چندمهارته و محدودیت هم‌زمانی', 'BasicForm', 'M', 'Medium'],
    ]),
  },
  {
    code: 'FRM-RM-04',
    title: 'شیفت و برنامه‌ی حضور',
    formTypeCode: 'OperationalForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('الگوی شیفت · چرخه‌ی شیفت · برنامه‌ی حضور (Roster) · غیبت و جایگزینی'),
    features: buildFeatures([
      ['F-RM-024', 'RM-HR-005', 'تعریف الگوی شیفت', 'BasicForm', 'M', 'Simple'],
      ['F-RM-025', 'RM-HR-006', 'تعریف چرخه‌ی شیفت (Rotation Pattern)', 'CalcEngine', 'M', 'VeryComplex'],
      ['F-RM-026', 'RM-HR-007', 'برنامه‌ی حضور شیفت (Shift Roster) و ثبت غیبت/جایگزینی', 'BasicForm', 'M', 'Simple'],
      ['F-RM-027', 'RM-HR-008', 'دریافت حضور و غیاب واقعی از سیستم HR و مقایسه با کارکرد ثبت‌شده در تولید', 'ServiceIntegration', 'S', 'Complex'],
    ]),
  },
  {
    code: 'FRM-RM-05',
    title: 'تقویم تولید',
    formTypeCode: 'OperationalForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('تعریف تقویم · تقویم مؤثر (گانت) · استثناها · رزرو نت · سناریو'),
    features: buildFeatures([
      ['F-RM-030', 'RM-CAL-001', 'تعریف تقویم در سطوح شرکت/شعبه/کارخانه/خط/ایستگاه با قاعده‌ی ارث‌بری PF-21', 'BasicForm', 'M', 'Simple'],
      ['F-RM-031', 'RM-CAL-002', 'محاسبه و نمایش تقویم مؤثر هر منبع با نمایش منشأ هر بازه', 'CalcEngine', 'M', 'Complex'],
      ['F-RM-032', 'RM-CAL-003', 'قرارداد دوطرفه با سیستم نت: نت توقف‌های برنامه‌ریزی‌شده را روی تقویم رزرو می‌کند', 'ServiceIntegration', 'M', 'VeryComplex'],
      ['F-RM-033', 'RM-CAL-004', 'قرارداد با برنامه‌ریزی تولید: تقویم مؤثر به‌صورت سرویس در اختیار PP قرار می‌گیرد', 'ServiceIntegration', 'M', 'VeryComplex'],
      ['F-RM-034', 'RM-CAL-005', 'ثبت استثنا با گردش تایید و تحلیل اثر بر سفارش‌های زمان‌بندی‌شده', 'CalcEngine', 'M', 'VeryComplex'],
      ['F-RM-035', 'RM-CAL-006', 'نمایش تقویم به‌صورت گانت/تقویمی با فیلتر منبع، و امکان ویرایش مستقیم روی نما', 'BasicForm', 'S', 'Simple'],
      ['F-RM-036', 'RM-CAL-007', 'سناریوی تقویم', 'BasicForm', 'S', 'Simple'],
      ['F-RM-037', 'RM-CAL-008', 'تقویم ۲۴/۷ برای پروفایل پیوسته با مفهوم کمپین به‌جای روزکاری', 'PlatformInfra', 'M', 'Medium'],
    ]),
  },
  {
    code: 'FRM-RM-06',
    title: 'کارکرد استاندارد و ظرفیت',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('انواع کارکرد · ظرفیت منبع · در دسترس‌بودن · ظرفیت وابسته به محصول · محدودیت متقابل · نمای بار/ظرفیت · سابقه‌ی تغییرات'),
    features: buildFeatures([
      ['F-RM-038', 'RM-CAP-001', 'تعریف انواع کارکرد استاندارد به‌صورت پویا توسط کاربر', 'BasicForm', 'M', 'Medium'],
      ['F-RM-039', 'RM-CAP-002', 'تعیین واحد، مبنای اندازه‌گیری و روش گردآوری', 'ServiceIntegration', 'M', 'Complex'],
      ['F-RM-040', 'RM-CAP-003', 'تعیین ظرفیت هر نوع کارکرد به‌ازای ایستگاه/گروه منبع', 'BasicForm', 'M', 'Simple'],
      ['F-RM-041', 'RM-CAP-004', 'ثبت درصد در دسترس‌بودن، تعداد در دسترس، و مدت توقف استاندارد به تفکیک نوع ظرفیت', 'BasicForm', 'M', 'Simple'],
      ['F-RM-042', 'RM-CAP-005', 'ظرفیت وابسته به محصول', 'BasicForm', 'M', 'Simple'],
      ['F-RM-043', 'RM-CAP-006', 'تعریف محدودیت متقابل منابع', 'BasicForm', 'S', 'Complex'],
      ['F-RM-044', 'RM-CAP-007', 'نمایش پروفایل ظرفیت', 'ReportDashboard', 'M', 'Simple'],
      ['F-RM-045', 'RM-CAP-008', 'بازخورد واقعی به استاندارد: مقایسه‌ی کارکرد واقعی با استاندارد و ارائه‌ی پیشنهاد اصلاح', 'PlatformInfra', 'S', 'VeryComplex'],
      ['F-RM-046', 'RM-CAP-009', 'نگهداری سابقه‌ی تغییرات استاندارد با تاریخ اثر برای تحلیل روند بهره‌وری', 'BasicForm', 'M', 'Simple'],
    ]),
  },
  {
    code: 'FRM-RM-07',
    title: 'طبقه‌بندی علل',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('علل توقف · نگاشت شش زیان OEE · علل ضایعات · علل دوباره‌کاری و انحراف · محدودسازی به‌ازای منبع · اقدام اصلاحی'),
    features: buildFeatures([
      ['F-RM-047', 'RM-CLS-001', 'تعریف درخت علل توقف چندسطحی', 'BasicForm', 'M', 'Medium'],
      ['F-RM-048', 'RM-CLS-002', 'طبقه‌بندی توقف', 'BasicForm', 'M', 'Medium'],
      ['F-RM-049', 'RM-CLS-003', 'تعیین نوع توقف', 'CalcEngine', 'M', 'Complex'],
      ['F-RM-050', 'RM-CLS-004', 'تعریف علل ضایعات به تفکیک ضایعات مواد و ضایعات محصول، به‌صورت درختی', 'BasicForm', 'M', 'Simple'],
      ['F-RM-051', 'RM-CLS-005', 'تعریف علل دوباره‌کاری و علل انحراف از برنامه، به‌صورت درختی', 'BasicForm', 'M', 'Simple'],
      ['F-RM-052', 'RM-CLS-006', 'ارتباط علت با اقدام اصلاحی و مسئول پیگیری', 'BasicForm', 'S', 'Simple'],
      ['F-RM-053', 'RM-CLS-007', 'محدودسازی فهرست علل مجاز به‌ازای خط/ایستگاه/نوع تجهیز، برای کاهش خطای ثبت اپراتور', 'BasicForm', 'M', 'Simple'],
    ]),
  },
  {
    code: 'FRM-RM-08',
    title: 'پیمانکاران تولید',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('پیمانکار · قابلیت · نرخ و زمان تحویل · انبار امانی · ظرفیت در نمای کل · ارزیابی عملکرد'),
    features: buildFeatures([
      ['F-RM-054', 'RM-OUT-001', 'تعریف پیمانکار تولید به‌عنوان منبع بیرونی با ظرفیت، تقویم و کارکرد استاندارد', 'BasicForm', 'M', 'Simple'],
      ['F-RM-055', 'RM-OUT-002', 'تعریف قابلیت پیمانکار', 'BasicForm', 'M', 'Simple'],
      ['F-RM-056', 'RM-OUT-003', 'تعریف نرخ کارمزد و زمان تحویل', 'BasicForm', 'M', 'Simple'],
      ['F-RM-057', 'RM-OUT-004', 'تعریف انبار امانی نزد پیمانکار', 'BasicForm', 'M', 'Simple'],
      ['F-RM-058', 'RM-OUT-005', 'لحاظ ظرفیت پیمانکار در نمای ظرفیت کل', 'BasicForm', 'S', 'Simple'],
      ['F-RM-059', 'RM-OUT-006', 'ارزیابی عملکرد پیمانکار', 'BasicForm', 'C', 'Simple'],
    ]),
  },
  {
    code: 'FRM-RM-09',
    title: 'مبانی هزینه‌یابی و ABC',
    formTypeCode: 'BasicInfoForm',
    domainCode: DOMAIN_CODE,
    domainTitle: DOMAIN_TITLE,
    tabLabels: splitTabs('فعالیت · محرک هزینه · نگاشت به کارکرد استاندارد · تسهیم منبع مشترک'),
    features: buildFeatures([
      ['F-RM-060', 'RM-COS-001', 'تعریف فعالیت', 'BasicForm', 'S', 'Simple'],
      ['F-RM-061', 'RM-COS-002', 'تعریف محرک هزینه', 'BasicForm', 'S', 'Simple'],
      ['F-RM-062', 'RM-COS-003', 'تعیین اینکه هر نوع کارکرد استاندارد به‌عنوان محرک هزینه قابل استفاده است یا نه', 'BasicForm', 'S', 'Simple'],
      ['F-RM-063', 'RM-COS-004', 'گردآوری خودکار مقدار محرک هزینه در زمان ثبت گزارش تولید و ارسال رویدادی به CO', 'ReportDashboard', 'S', 'Medium'],
      ['F-RM-064', 'RM-COS-005', 'تسهیم منبع مشترک بین چند مرکز هزینه با ضریب یا با مبنای مقدار واقعی', 'BasicForm', 'S', 'Simple'],
    ]),
  },
];
