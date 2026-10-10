/**
 * شکل ردیف‌هایی که قالب FRM-PE-01 مصرف می‌کند. داده از اسکیمای mes می‌آید
 * (frm-pe-01.service.ts)؛ این فرم داده‌ی Mock ندارد.
 */
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'secondary';

/**
 * جفت «برچسب / مقدار» برای سربرگ فرم‌های پروتوتایپ PE و ME. از نسخه‌ی پروتوتایپ همین فایل
 * مانده چون آن فرم‌ها از این‌جا import می‌کنند؛ با پیاده‌شدن آن‌ها می‌تواند به shared برود.
 */
export interface FieldItem {
  label: string;
  value: string;
}

/** کدهای موقت تا رسیدن کدلیست اصلی (به سرآغاز mes_frm_pe01_setup.sql نگاه کنید). */
export const ROLE_LABEL: Record<number, string> = {
  1: 'محصول نهایی',
  2: 'نیمه‌ساخته',
  3: 'ماده‌ی اولیه',
  4: 'مواد بسته‌بندی',
  5: 'محصول جانبی',
};
export const ROLE_ICON: Record<number, string> = {
  1: 'pi pi-box',
  2: 'pi pi-sync',
  3: 'pi pi-database',
  4: 'pi pi-inbox',
  5: 'pi pi-share-alt',
};
export const SOURCE_LABEL: Record<number, string> = { 1: 'تولید داخلی', 2: 'خرید', 3: 'برون‌سپاری', 4: 'انتقال بین‌سایتی' };
export const TRACKING_LABEL: Record<number, string> = { 0: 'بدون ردیابی', 1: 'بچ', 2: 'سریال', 3: 'بچ + سریال' };

export interface ItemRow {
  productId: number;
  code: string;
  title: string;
  unit: string;
  group: string;
  hasRole: boolean;
  roleCode: number | null;
  role: string;
  tracking: string;
  trackingCode: number | null;
  trackingMandatory: boolean;
  isPhantom: boolean;
  isDimensional: boolean;
  policySummary: string;
  attributeCount: number;
  lotSizeCount: number;
  variantCount: number;
  description: string;
}

export interface PolicyRow {
  product: string;
  priority: number;
  source: string;
  sourceCode: number;
  partner: string;
  share: string;
  warning: string;
  description: string;
}

export interface AttributeDefRow {
  code: string;
  title: string;
  unit: string;
  dataType: string;
  itemCount: number;
  description: string;
}

export interface ItemAttributeRow {
  product: string;
  attribute: string;
  value: string;
  description: string;
}

export interface DimensionRow {
  code: string;
  title: string;
  values: { code: string; title: string; used: boolean }[];
}

export interface ItemDimensionRow {
  product: string;
  dimension: string;
  values: string;
}

export interface VariantRow {
  product: string;
  code: string;
  title: string;
  active: boolean;
}

export interface LotSizeRow {
  product: string;
  line: string;
  batch: string;
  min: string;
  max: string;
  multiple: string;
  description: string;
}

/** یک ناسازگاری قلم، برای بنر و ستون هشدار. */
export interface ItemIssue {
  productId: number;
  tone: 'danger' | 'warning';
  text: string;
}
