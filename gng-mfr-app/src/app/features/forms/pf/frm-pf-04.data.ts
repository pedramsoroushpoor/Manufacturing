export interface PreviewField {
  label: string;
  value: string;
  custom?: boolean;
}
export const PREVIEW_FORM_TARGET = 'FRM-PC-02 — دستور کار';
export const PREVIEW_BASE_FIELDS: PreviewField[] = [
  { label: 'محصول', value: 'قرص استامینوفن ۵۰۰' },
  { label: 'نوع دستور کار', value: 'کارمزدی دریافتی' },
];
export const PREVIEW_CUSTOM_FIELDS: PreviewField[] = [
  { label: 'کد GTIN', value: '۶۲۶۱۱۰۰۲۰۰۱۴۳', custom: true },
  { label: 'کد پروژه‌ی مشتری', value: 'PRJ-2214', custom: true },
];
export const CUSTOM_FIELD_BADGE = 'فیلدهای اضافی — تعریف‌شده توسط کاربر';

export interface ExtensibilityTool {
  label: string;
  meta: string;
}
export const OTHER_TOOLS: ExtensibilityTool[] = [
  { label: 'موجودیت اضافی (جدول کاربرساخته)', meta: '۳ مورد' },
  { label: 'الگوی چاپ قابل طراحی', meta: '۱۴ الگو' },
  { label: 'پیوست و مدارک', meta: 'کامپوننت مشترک' },
  { label: 'ورود و خروج اکسل', meta: 'کامپوننت مشترک' },
];
export const WHY_NOTE =
  'چرا این فرم؟ برای بازار بیرونی حیاتی است: هر مشتری چند فیلد اختصاصی می‌خواهد. بدون این ابزار، هر استقرار نیازمند نگهداشت محصول اختصاصی غیرممکن می‌شود.';

export interface DefinedFieldRow {
  form: string;
  title: string;
  type: string;
  required: 'بله' | 'خیر' | 'شرطی';
  inList: boolean;
  inReport: boolean;
}
export const DEFINED_FIELDS: DefinedFieldRow[] = [
  { form: 'دستور کار FRM-PC-02', title: 'کد پروژه‌ی مشتری', type: 'متن', required: 'شرطی', inList: true, inReport: true },
  { form: 'ساختار محصول FRM-PE-02', title: 'شماره پروانه ساخت', type: 'متن', required: 'بله', inList: true, inReport: true },
  { form: 'تجهیزات FRM-RM-02', title: 'تاریخ کالیبراسیون بعدی', type: 'تاریخ', required: 'بله', inList: false, inReport: true },
  { form: 'قلم FRM-PE-01', title: 'کد GTIN', type: 'عدد', required: 'خیر', inList: true, inReport: false },
];

export const RULE_NOTE = 'قاعده‌ی زمان ذخیره فرم اجرا می‌شود · قابل تعریف در سطح فیلد یا فرم';

export const BANNER_SUCCESS = '۲۴ فیلد اضافی روی ۹ فرم تعریف‌شده است — بدون یک خط کد و بدون نسخه‌ی اختصاصی نرم‌افزار.';

export const CUSTOM_ENTITY_NOTE = 'موجودیت اضافی: جدول کاملاً کاربرساخته با فیلدهای دلخواه، مستقل از موجودیت‌های استاندارد سیستم — برای نیازهای خاص هر مشتری.';
export const BUSINESS_RULE_NOTE = 'قاعده‌ی کاربرساخته (Business Rule): اعتبارسنجی و محاسبات سفارشی بدون کدنویسی، با ویرایشگر فرمول قابل‌فهم برای کاربر کسب‌وکار.';
export const PRINT_TEMPLATE_NOTE = 'الگوی چاپ قابل طراحی توسط کاربر: طراحی بصری برچسب، فاکتور و گزارش با درگ‌اند‌دراپ، بدون وابستگی به تیم توسعه.';
export const ATTACHMENT_NOTE = 'پیوست فایل با نسخه‌بندی و کنترل دسترسی روی همه‌ی فرم‌ها — یک کامپوننت مشترک، نه پیاده‌سازی جداگانه در هر فرم.';
export const EXCEL_NOTE = 'ورود/خروج اکسل روی همه‌ی فرم‌های اطلاعات پایه و عملیاتی — با اعتبارسنجی سطر‌به‌سطر پیش از درج.';

export const AUDIT_RANGE = 'F-PF-026 تا F-PF-030, F-PF-035';
