/**
 * شکل ردیف‌هایی که قالب FRM-PE-06 مصرف می‌کند. داده از اسکیمای mes می‌آید
 * (frm-pe-06.service.ts)؛ این فرم داده‌ی Mock ندارد.
 */
export interface MatrixStructure {
  id: number;
  code: string;
  title: string;
  product: string;
  base: string;
  revision: string;
  dimensions: string;
  variantCount: number;
  dependentItems: number;
  independentItems: number;
}

/** یک ردیف مدل پایه؛ برای ردیف وابسته، مقدار به‌ازای هر مقدار بُعد. */
export interface MatrixItem {
  itemId: number;
  seq: number;
  product: string;
  unit: string;
  role: string;
  baseQuantity: number;
  dimension: string | null;
  values: { code: string; title: string; quantity: number | null }[];
}

/** ماتریس «ترکیب × ردیف» برای ساختار مشتق هر ترکیب. */
export interface DerivedMatrix {
  items: { itemId: number; label: string; unit: string; dependent: boolean }[];
  variants: { code: string; title: string; quantities: (number | null)[]; complete: boolean }[];
}
