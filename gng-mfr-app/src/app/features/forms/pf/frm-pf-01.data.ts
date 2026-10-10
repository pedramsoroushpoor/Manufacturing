export interface IndustryProfile {
  title: string;
  meta: string;
  badge?: string;
  active?: boolean;
}
export const INDUSTRY_PROFILES: IndustryProfile[] = [
  { title: 'مونتاژی', meta: 'گسسته · فانتوم · توالی' },
  { title: 'شیمیایی', meta: 'پیوسته · بازیابی حلال' },
  { title: 'غذایی', meta: 'دسته‌ای/پیوسته · FEFO · انقضا' },
  { title: 'بهداشتی و آرایشی', meta: 'دسته‌ای · انبوه SKU' },
  { title: 'دارویی', meta: 'دسته‌ای · بچ اجباری · GMP', badge: 'فعال', active: true },
  { title: 'پوشاک', meta: 'گسسته · ماتریس سایز×رنگ' },
  { title: 'نفت و پتروشیمی', meta: 'پیوسته · برش · موازنه‌ی جرم' },
  { title: 'معدن', meta: 'پیوسته · عیار خوراک' },
  { title: 'ساختمان', meta: 'پروژه‌ای · WBS · منبع سیار' },
  { title: 'خودرو', meta: 'گسسته · VIN · پیکربندی‌پذیر' },
];

export interface EffectiveValueRow {
  dimension: string;
  value: string;
  possible: string;
  origin: string;
  overridden?: boolean;
}
export const EFFECTIVE_VALUES: EffectiveValueRow[] = [
  { dimension: 'ماهیت تولید', value: 'دسته‌ای (Batch)', possible: 'گسسته · پیوسته · پروژه‌ای', origin: 'پروفایل صنعت' },
  { dimension: 'ساختار محصول', value: 'فرمولی + درجه‌خلوص‌پذیر', possible: 'ماتریسی · فرمولی · پیکربندی‌پذیر', origin: 'بازنویسی در سطح خط', overridden: true },
  { dimension: 'هویت اقلام', value: 'بچ + سریال', possible: 'بدون · بچ · بچ+سریال', origin: 'پروفایل صنعت' },
  { dimension: 'خروجی تولید', value: 'چندمحصولی (Co-product)', possible: 'تک · چند · با جانبی', origin: 'بازنویسی در سطح خط', overridden: true },
  { dimension: 'مبنای مقدار', value: 'وزن', possible: 'تعداد · وزن · حجم · طول · انرژی', origin: 'پروفایل صنعت' },
  { dimension: 'کیفیت ماده', value: 'دارای عیار / خلوص', possible: 'بدون · دارای عیار', origin: 'پروفایل صنعت' },
  { dimension: 'مبنای دستور کار', value: 'سفارش‌محور', possible: 'سفارش · کمپین · شیفت · پروژه', origin: 'پروفایل صنعت' },
  { dimension: 'سیاست مصرف', value: 'ترکیبی', possible: 'دستی · Backflush · ترکیبی', origin: 'بازنویسی در سطح خط', overridden: true },
];

export interface OverrideHierarchyItem {
  level: string;
  value: string;
  highlighted?: boolean;
}
export const OVERRIDE_HIERARCHY: OverrideHierarchyItem[] = [
  { level: 'ماهیت', value: 'دستی' },
  { level: 'ارثی', value: 'شرکت — گروه صنعتی گلرنگ' },
  { level: 'Backflush', value: 'شعبه — دارو و بهداشت' },
  { level: 'ترکیبی', value: 'کارخانه — داروسازی ۱', highlighted: true },
];
export const OVERRIDE_TARGET = 'خط قرص‌سازی ۲';
export const OVERRIDE_NOTE =
  'مقدار مؤثر: ترکیبی — تعریف‌شده در سطح خط. سه سطح بالاتر بازنویسی شده‌اند.';
export const RISK_NOTE =
  'تغییر پروفایل — عملیات پرریسک. تغییر پروفایل مستلزم گردش تایید و گزارش تحلیل اثر است. ۱٬۲۴۰ ساختار محصول · ۸۶ روش ساخت · ۳٬۳۱۲ دستور کار بسته.';
export const BANNER_DANGER =
  'تغییر پروفایل پس از وجود داده‌ی عملیاتی فعال است. فقط از گردش تایید و تحلیل اثر ممکن است.';

export interface FeatureRuleItem {
  label: string;
  status: 'ok' | 'warn';
}
export const PROFILE_RULES: FeatureRuleItem[] = [
  { label: 'رفتار فرم‌ها (فیلد الزامی/اختیاری، تب فعال/غیرفعال) بر اساس پروفایل صنعت فعال تغییر می‌کند', status: 'ok' },
  { label: 'شریک استقرار می‌تواند پروفایل سفارشی تعریف و آن را به‌عنوان بسته‌ی پیکربندی صادر/وارد کند', status: 'ok' },
  { label: 'پروفایل سفارشی «شیمیایی-رنگ‌سازی» در انتظار صدور نسخه‌ی نهایی است', status: 'warn' },
];

export interface OrgLevelRow {
  level: string;
  sample: string;
  canOverride: string;
}
export const ORG_LEVELS: OrgLevelRow[] = [
  { level: 'شرکت', sample: 'گروه صنعتی گلرنگ', canOverride: 'مبنای همه‌ی ابعاد (Default سازمانی)' },
  { level: 'شعبه', sample: 'دارو و بهداشت', canOverride: 'بازنویسی هر بُعد به‌جز هویت اقلام' },
  { level: 'کارخانه', sample: 'داروسازی ۱', canOverride: 'بازنویسی هر بُعد + سیاست گِردکردن' },
  { level: 'خط تولید', sample: 'خط قرص‌سازی ۲', canOverride: 'بازنویسی تک‌بُعدی با گردش تایید' },
];
export const PRECEDENCE_NOTE =
  'قاعده‌ی ارجحیت: نزدیک‌ترین سطح بازنویسی‌شده همیشه برنده است — خط > کارخانه > شعبه > شرکت.';
export const ENTITY_NOTE = 'هر موجودیت اطلاعات پایه (واحد، انبار، مرکز هزینه، تقویم) یک صاحب سطح دارد که دامنه‌ی اثر آن را تعیین می‌کند.';
export const EXTERNAL_NOTE = 'انبارها و مراکز هزینه از سیستم‌های انبار و مالی فراخوانی می‌شوند، نه در این‌جا بازتعریف.';

export interface UnitRow {
  primary: string;
  secondary: string;
  fixedFactor: string;
  variableFactor: string;
}
export const UNIT_ROWS: UnitRow[] = [
  { primary: 'کیلوگرم (kg)', secondary: 'گرم (g)', fixedFactor: '×۱٬۰۰۰', variableFactor: '—' },
  { primary: 'لیتر (L)', secondary: 'کیلوگرم (kg)', fixedFactor: '—', variableFactor: 'وابسته به چگالی بچ' },
  { primary: 'عدد', secondary: 'کارتن', fixedFactor: '÷۲۴', variableFactor: '—' },
  { primary: 'متر مربع', secondary: 'رول', fixedFactor: '—', variableFactor: 'وابسته به عرض رول بچ' },
  { primary: 'کیلووات‌ساعت', secondary: 'ژول', fixedFactor: '×۳٬۶۰۰٬۰۰۰', variableFactor: '—' },
];

export const POTENCY_NOTE =
  'درجه خلوص/عیار (Potency): موتور محاسباتی مقدار مؤثر ماده را از روی مقدار اسمی و درصد خلوص بچ ورودی مشتق می‌کند — در مصرف، رسید و بهای تمام‌شده به‌صورت خودکار اعمال می‌شود.';
export interface RoundingRow {
  scope: string;
  policy: string;
  precision: string;
}
export const ROUNDING_ROWS: RoundingRow[] = [
  { scope: 'قلم — مواد اولیه فله', policy: 'گِرد به پایین', precision: '۳ رقم اعشار (kg)' },
  { scope: 'قلم — بسته‌بندی شمارشی', policy: 'گِرد به نزدیک‌ترین', precision: 'صحیح' },
  { scope: 'عملیات — توزین', policy: 'گِرد به بالا', precision: '۲ رقم اعشار (kg)' },
  { scope: 'عملیات — پرکنی حجمی', policy: 'گِرد به نزدیک‌ترین', precision: '۱ رقم اعشار (L)' },
];

export const MASS_BALANCE_NOTE =
  'موازنه‌ی جرم/انرژی برای پروفایل‌های پیوسته (شیمیایی، نفت و پتروشیمی، معدن) به‌صورت خودکار در هر گزارش تولید بررسی می‌شود؛ انحراف بیش از آستانه به کنترل کیفیت هشدار می‌دهد.';
export const MASS_BALANCE_STAT = { label: 'آستانه‌ی هشدار انحراف موازنه', value: '±۱٫۵٪' };

export const CALENDAR_NOTE =
  'تقویم شمسی و میلادی هم‌زمان در همه‌ی فرم‌های عملیاتی و گزارش‌ها نمایش داده می‌شود — نه فقط اطلاعات پایه.';
export interface LanguageRow {
  field: string;
  languages: string;
}
export const LANGUAGE_ROWS: LanguageRow[] = [
  { field: 'نام کالا', languages: 'فارسی (اصلی) · English · العربیة' },
  { field: 'عنوان عملیات', languages: 'فارسی (اصلی) · English' },
  { field: 'واحد اندازه‌گیری', languages: 'فارسی (اصلی) · English' },
];

export const AUDIT_RANGE = 'F-PF-004 تا F-PF-011, F-PF-037 تا F-PF-040, F-PF-045 تا F-PF-046';
