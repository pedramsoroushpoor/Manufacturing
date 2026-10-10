/**
 * شکل ردیف‌هایی که قالب FRM-PE-04 مصرف می‌کند. داده از اسکیمای mes می‌آید
 * (frm-pe-04.service.ts)؛ این فرم داده‌ی Mock ندارد.
 */

/** کدهای موقت تا رسیدن کدلیست اصلی (به سرآغاز mes_frm_pe04_setup.sql نگاه کنید). */
export const OUTPUT_TYPE: Record<number, string> = { 1: 'محصول اصلی', 2: 'هم‌زاد', 3: 'جانبی', 4: 'ضایعات مورد انتظار', 5: 'ماده‌ی بازیابی‌شده' };
export const OUTPUT_PROCESS: Record<number, string> = { 1: 'اصلی', 2: 'دوباره‌کاری', 3: 'بازیافت', 4: 'جداسازی' };
export const VALUATION: Record<number, string> = { 1: 'بازیافتی', 2: 'فروشی', 3: 'بی‌ارزش' };

export interface OutputRow {
  structureId: number;
  typeCode: number;
  type: string;
  product: string;
  quantity: string;
  costShare: number | null;
  process: string;
  valuation: string;
  yieldPercent: number | null;
  yieldRange: string;
  recyclable: boolean | null;
  description: string;
}

export interface StructureSummary {
  id: number;
  code: string;
  title: string;
  yieldTotal: number | null;
  hasYieldTable: boolean;
  massOk: boolean;
  costTotal: number | null;
  coProducts: number;
  costOk: boolean;
}
