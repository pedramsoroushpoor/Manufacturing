export interface TimelineBlock {
  label: string;
  tone: 'obsolete' | 'active' | 'upcoming' | 'draft';
  startPct: number;
  widthPct: number;
  row: number;
}
export const TIMELINE_BLOCKS: TimelineBlock[] = [
  { label: 'v2 — منسوخ', tone: 'obsolete', startPct: 0, widthPct: 26, row: 0 },
  { label: 'فعال تا ۱۴۰۵/۰۲/۳۱ — v3', tone: 'active', startPct: 26, widthPct: 22, row: 1 },
  { label: 'همزیستی دو نسخه', tone: 'upcoming', startPct: 43, widthPct: 5, row: 2 },
  { label: 'فعال از ۱۴۰۵/۰۳/۰۱ — v4', tone: 'upcoming', startPct: 48, widthPct: 38, row: 2 },
  { label: 'ECO-0074 پیش‌نویس — v5', tone: 'draft', startPct: 82, widthPct: 18, row: 3 },
];
export const TIMELINE_MONTHS = ['فروردین', 'خرداد', 'مرداد', 'مهر', 'آذر', 'اسفند'];
export const TIMELINE_TODAY_PCT = 43;
export const TIMELINE_NOTE = 'همزیستی چند نسخه‌ی فعال با شرط اعتبار متفاوت مجاز است.';
export const BANNER_SUCCESS =
  'دو نسخه هم‌زمان فعال‌اند. v3 تا پایان اردیبهشت و v4 از خرداد — دستورهای قدیمی همچنان با v3 کار می‌کنند.';

export interface LifecycleStage {
  label: string;
  tone: 'secondary' | 'warning' | 'success' | 'info' | 'danger';
}
export const LIFECYCLE_STAGES: LifecycleStage[] = [
  { label: 'پیش‌نویس', tone: 'secondary' },
  { label: 'در تایید', tone: 'warning' },
  { label: 'فعال', tone: 'success' },
  { label: 'تایید‌شده', tone: 'info' },
  { label: 'منسوخ', tone: 'danger' },
];
export const LIFECYCLE_RULES: string[] = [
  'نسخه‌ی تایید‌شده هرگز ویرایش نمی‌شود.',
  'هر تغییر ⇐ نسخه‌ی جدید از مسیر ECO.',
  'فعال‌سازی اتمیک ECO — همه یا هیچ.',
];

export interface WipPolicyItem {
  label: string;
  selected?: boolean;
}
export const WIP_POLICIES: WipPolicyItem[] = [
  { label: 'مصرف تا اتمام — پیش‌فرض', selected: true },
  { label: 'انتقال به نسخه‌ی جدید' },
  { label: 'تعیین دستی برای هر دستور' },
];

export const STAT_OPEN_ECO = { label: 'ECO باز', value: 1 };
export const STAT_ACTIVE_VERSIONS = { label: 'نسخه‌های فعال', value: 2 };

export interface EffectivityTypeRow {
  type: string;
  condition: string;
  entities: string;
  status: 'فعال' | 'در فاز بعد';
}
export const EFFECTIVITY_TYPES: EffectivityTypeRow[] = [
  { type: 'تاریخ‌محور', condition: 'از تاریخ تا تاریخ', entities: 'ساختار محصول · روش ساخت · نسخه تولید · تقویم', status: 'فعال' },
  { type: 'بچ‌محور', condition: 'از شماره بچ مشخص', entities: 'ساختار محصول · نسخه تولید', status: 'فعال' },
  { type: 'سفارش‌محور', condition: 'برای دستورهای خط با مشتری خاص', entities: 'نسخه تولید', status: 'فعال' },
  { type: 'مقدار تجمعی‌محور', condition: 'پس از تولید n واحد', entities: 'روش ساخت · ابزار', status: 'در فاز بعد' },
];

export interface DiffRow {
  index: string;
  itemV3: string;
  itemV4: string;
  change: 'بدون تغییر' | 'تغییر مقدار' | 'افزوده' | 'حذف‌شده';
  changeDetail?: string;
}
export const DIFF_ROWS: DiffRow[] = [
  { index: '۳۰ — پویدون K30', itemV3: '۲٫۳۰٪', itemV4: '۲٫۳۰٪', change: 'بدون تغییر' },
  { index: '۴۰ — اتانول ۹۶٪', itemV3: '۵٫۵۰٪', itemV4: '۶٫۰۰٪', change: 'تغییر مقدار', changeDetail: '+۰٫۵' },
  { index: '۶۰ — کراس‌کارملوز', itemV3: '—', itemV4: '۱٫۸۴٪', change: 'افزوده' },
  { index: '۵۵ — تالک', itemV3: '۰٫۵۰٪', itemV4: '—', change: 'حذف‌شده' },
];

export const ECO_INDEPENDENT_NOTE =
  'درخواست تغییر مهندسی (ECO) یک موجودیت مستقل با شماره، شرح، دامنه‌ی تغییر، پیوست و گردش تایید خودش است — نه یک فیلد روی BOM.';
export const IMPACT_ANALYSIS_NOTE =
  'تحلیل اثر پیش از تایید: تعداد ساختار محصول، روش ساخت، دستور کار باز و سفارش فروش تحت تاثیر به‌صورت خودکار محاسبه و ضمیمه‌ی درخواست تایید می‌شود.';
export const ATOMIC_NOTE = 'اجرای هم‌زمان و اتمیک همه‌ی تغییرات یک ECO — یا همه اعمال می‌شوند یا هیچ‌کدام.';

export const AUDIT_RANGE = 'F-PF-012 تا F-PF-019';
