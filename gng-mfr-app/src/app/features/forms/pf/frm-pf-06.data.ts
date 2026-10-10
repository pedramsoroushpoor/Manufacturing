export interface SignaturePoint {
  label: string;
  status: 'فعال' | 'فقط پروفایل دارویی';
}
export const SIGNATURE_POINTS: SignaturePoint[] = [
  { label: 'تایید ساختار محصول', status: 'فعال' },
  { label: 'تایید و فعال‌سازی ECO', status: 'فعال' },
  { label: 'آزادسازی بچ محصول', status: 'فعال' },
  { label: 'تایید گزارش تولید', status: 'فقط پروفایل دارویی' },
  { label: 'تغییر سطح ردیابی قلم', status: 'فعال' },
  { label: 'بازگشایی دستور بسته‌شده', status: 'فعال' },
];
export const SIGNATURE_NOTE = 'احراز هویت مجدد در لحظه‌ی امضا';

export interface ComplianceItem {
  code: string;
  label: string;
  tone: 'ok' | 'warn';
  meta?: string;
}
export const COMPLIANCE_ITEMS: ComplianceItem[] = [
  { code: 'Attributable', label: 'هر رکورد منتسب به کاربر', tone: 'ok' },
  { code: 'Legible', label: 'خوانا و قابل بازیابی', tone: 'ok' },
  { code: 'Contemporaneous', label: 'مهر زمانی سرور', tone: 'ok' },
  { code: 'Original', label: 'سند اصلی حذف نمی‌شود', tone: 'ok' },
  { code: 'Accurate', label: 'با سند معکوس اصلاح می‌شود', tone: 'ok' },
  { code: 'Complete', label: 'بایگانی ۱۰ ساله', tone: 'warn', meta: 'در حال پیکربندی' },
];

export const STAT_SIGNATURES = { label: 'امضای الکترونیک', value: '۱٬۲۰۴' };
export const STAT_AUDIT_RECORDS = { label: 'رکورد ممیزی', value: '۴۸٬۲۹۱' };
export const DELETE_NOTE = 'فعل حذف: رکورد عملیاتی تاییدشده حذف نمی‌شود. اصلاح فقط با سند معکوس یا نسخه‌ی اصلاحی انجام می‌گیرد.';

export interface AuditLogRow {
  time: string;
  user: string;
  entity: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
  signed: boolean;
}
export const AUDIT_LOG: AuditLogRow[] = [
  { time: '۱۴۰۵/۰۵/۲۷ ۰۹:۰۲:۱۱', user: 'دکتر نوروزی', entity: 'ECO-1405-0074', field: 'وضعیت', oldValue: 'در تایید', newValue: 'تاییدشده', reason: 'مصوبه کمیته فنی', signed: true },
  { time: '۱۴۰۵/۰۵/۲۶ ۱۶:۴۸:۲۹', user: 'س. مصطفایی', entity: 'BOM-ACT500-v5', field: 'ردیف ۳۰ — قلم', oldValue: 'پوویدون K30', newValue: 'پوویدون K25', reason: 'قطع واردات', signed: true },
  { time: '۱۴۰۵/۰۵/۲۶ ۱۱:۲۰:۰۴', user: 'م. رضایی', entity: 'WO-1405-04872', field: 'مقدار سفارش', oldValue: '۱۸۰٬۰۰۰', newValue: '۲۰۰٬۰۰۰', reason: 'افزایش سفارش مشتری', signed: false },
  { time: '۱۴۰۵/۰۵/۲۵ ۰۸:۰۵:۱۷', user: 'م. رضایی', entity: 'WO-1405-04872', field: 'وضعیت', oldValue: 'تاییدشده', newValue: 'آزادشده', reason: '—', signed: false },
  { time: '۱۴۰۵/۰۵/۲۴ ۱۴:۴۰:۰۲', user: 'ا. کریمی', entity: 'REQ-1405-00913', field: 'وضعیت', oldValue: 'ثبت‌شده', newValue: 'تاییدشده', reason: '—', signed: false },
  { time: '۱۴۰۵/۰۵/۲۳ ۱۰:۱۵:۳۳', user: 'دکتر رحیمی', entity: 'ITM-102457', field: 'سطح ردیابی', oldValue: 'بدون ردیابی', newValue: 'بچ — الزام GMP', reason: 'الزام GMP', signed: true },
];

export const BANNER_INFO = 'بدون این فرم ورود به بازار دارویی و غذایی ممکن نیست — و برای سایر بازارها مزیت رقابتی است.';

export const AUDIT_TRAIL_NOTE = 'لاگ ممیزی کامل (Audit Trail) روی همه‌ی موجودیت‌ها — چه کسی، چه زمانی، چه مقداری را به چه مقداری و چرا تغییر داد.';
export const SIGNATURE_MECH_NOTE = 'امضای الکترونیک با احراز هویت مجدد در نقاط بحرانی — رمز عبور یا OTP در لحظه‌ی امضا، نه صرفاً کلیک تایید.';
export const ALCOA_NOTE = 'انطباق با اصول ALCOA+ و الزامات 21 CFR Part 11 — فقط برای پروفایل دارویی فعال است؛ سایر پروفایل‌ها می‌توانند اختیاری فعال کنند.';
export const NO_DELETE_NOTE = 'غیرقابل حذف بودن رکوردهای عملیاتی تاییدشده — اصلاح تنها از مسیر سند معکوس یا نسخه‌ی جدید ممکن است.';

export const AUDIT_RANGE = 'F-PF-041 تا F-PF-044';
