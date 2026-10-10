export interface TraceCard {
  tone: 'req' | 'feature' | 'form' | 'task';
  label: string;
  value: string;
  meta: string;
}
export const TRACE_CHAIN: TraceCard[] = [
  { tone: 'req', label: 'نیازمندی', value: 'PE-CMP-005', meta: 'ردیف مصرفی مبتنی بر عیار' },
  { tone: 'feature', label: 'فیچر', value: 'F-PE-023', meta: 'اولویت M — پیچیده' },
  { tone: 'form', label: 'فرم', value: 'FRM-PE-02', meta: 'ساختار محصول — اقدام ۹' },
  { tone: 'task', label: 'تسک توسعه', value: 'T-1234', meta: 'اسپرینت ۷ — ۵ نفرروز' },
];
export const CHAIN_NOTE = 'زنجیره‌ی ردیابی: نیازمندی ← فیچر ← فرم ← تسک — کد پس از تخصیص هرگز بازاستفاده نمی‌شود.';

export const STAT_FEATURES = { label: 'فیچر', value: '۳۶۰', meta: 'M ۲۸۵ · S ۶۸ · C ۷' };
export const STAT_REQUIREMENTS = { label: 'نیازمندی', value: '۳۶۰', meta: '۰ سند تحلیل' };
export const STAT_ESTIMATE = { label: 'برآورد', value: '۲٬۶۹۲', meta: 'نفرروز — ۲۶۵ اقدام · پیشنهادی' };
export const STAT_FORMS = { label: 'فرم', value: '۴۷', meta: '۲۶۳ تب' };

export const OPEN_DECISIONS: string[] = [
  'عمق پیکربندی‌پذیری محصول در نسخه‌ی اول',
  'جایگاه پروفایل ساختمان — در PE یا سیستم مستقل',
  'ماتریس تعویض: جفت‌محصول یا سطح ویژگی',
  'سطح پیش‌فرض ثبت گزارش تولید',
  'واحد بازیابی حلال: خط مستقل یا عملیات',
];

export const WARNING_NOTE =
  '۱۱ نیازمندی جدید پیشنهادی برای برون‌سپاری سه‌گانه‌ای، در سند مقابل، در انتظار تایید — پس از تصویب، فیچرلیست و کاتالوگ فرم بازتولید می‌شوند.';

export interface CoverageRow {
  subsystem: string;
  featureCount: number;
  formCount: number;
  coveragePct: number;
  pct: string;
  noRef: string;
}
export const COVERAGE_ROWS: CoverageRow[] = [
  { subsystem: 'چارچوب مشترک PF', featureCount: 46, formCount: 7, coveragePct: 100, pct: '۱۰۰٪', noRef: '.' },
  { subsystem: 'مدیریت منابع RM', featureCount: 64, formCount: 9, coveragePct: 100, pct: '۱۰۰٪', noRef: '.' },
  { subsystem: 'مهندسی محصول PE', featureCount: 74, formCount: 9, coveragePct: 100, pct: '۱۰۰٪', noRef: '.' },
  { subsystem: 'مهندسی تولید ME', featureCount: 76, formCount: 10, coveragePct: 100, pct: '۱۰۰٪', noRef: '.' },
  { subsystem: 'کنترل تولید PC', featureCount: 100, formCount: 12, coveragePct: 100, pct: '۱۰۰٪', noRef: '.' },
];
export const COVERAGE_TOTAL = { featureCount: 360, formCount: 47, pct: '۱۰۰٪' };

export interface RecentRequirementRow {
  code: string;
  description: string;
  feature: string;
  form: string;
  priority: string;
  status: 'پیشنهادشده' | 'پوشش‌داده‌شده';
}
export const RECENT_REQUIREMENTS: RecentRequirementRow[] = [
  { code: 'PC-OUT-012', description: 'سه مرجع اجباری روی هر تراکنش برون‌سپاری', feature: '—', form: '—', priority: 'M', status: 'پیشنهادشده' },
  { code: 'PC-OUT-017', description: 'تولید خودکار سند مقابل جفت‌شده', feature: '—', form: '—', priority: 'M', status: 'پیشنهادشده' },
  { code: 'PE-RCV-006', description: 'سقف دفعات بازیابی و شمارش چرخه', feature: 'F-PE-046', form: 'FRM-PE-05', priority: 'M', status: 'پوشش‌داده‌شده' },
  { code: 'ME-PVR-004', description: 'انتخاب خودکار نسخه‌ی تولید', feature: 'F-ME-062', form: 'FRM-ME-08', priority: 'M', status: 'پوشش‌داده‌شده' },
];

export const BANNER_SUCCESS = 'پوشش ردیابی ۱۰۰٪ است. هر ۳۶۰ فیچر دقیقاً یک‌بار در ۴۷ فرم پوشش داده شده — بدون فیچر جامانده یا تکراری.';

export const REQ_CODE_NOTE = 'هر نیازمندی کد یکتا و پایدار دارد — کد پس از تخصیص هرگز بازاستفاده نمی‌شود.';
export const FEATURE_REF_NOTE = 'هر فیچر دقیقاً به یک یا چند نیازمندی ارجاع دارد — فیچر بدون ارجاع به نیازمندی پذیرفته نمی‌شود.';
export const AUTO_MATRIX_NOTE = 'ماتریس ردیابی به‌صورت خودکار از این ارجاعات تولید می‌شود و در هر بازبینی سند به‌روز می‌گردد — ابزار داخلی تیم توسعه، در نسخه‌ی مشتری عرضه نمی‌شود.';

export const AUDIT_RANGE = 'F-PF-001 تا F-PF-003';
