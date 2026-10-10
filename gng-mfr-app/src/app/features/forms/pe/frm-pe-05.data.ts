/**
 * شکل ردیف‌هایی که قالب FRM-PE-05 مصرف می‌کند. داده از اسکیمای mes می‌آید
 * (frm-pe-05.service.ts)؛ این فرم داده‌ی Mock ندارد.
 */

/** کدهای موقت تا رسیدن کدلیست اصلی (به سرآغاز mes_frm_pe05_setup.sql نگاه کنید). */
export const RECOVERY_MODE: Record<number, string> = { 1: 'قلم مستقل', 2: 'گرید کیفی همان قلم' };
export const CONSUMPTION_PRIORITY: Record<number, string> = { 1: 'اول بازیابی‌شده تا سقف مجاز، سپس نو', 2: 'اول نو، سپس بازیابی‌شده' };

export interface RecoveredRow {
  code: string;
  product: string;
  source: string;
  mode: string;
  grade: string;
  rate: string;
  loss: string;
  net: string;
  ratio: string;
  ratioText: string;
  purity: string;
  qc: boolean;
  cycles: string;
  priority: string;
  unit: string;
  description: string;
}

export interface FormulaRow {
  structure: string;
  item: string;
  quantity: string;
  recovery: string;
  maxUse: number | null;
  hasMaterial: boolean;
}

export interface RecoveryOutputRow {
  structure: string;
  product: string;
  quantity: string;
  description: string;
}
