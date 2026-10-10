/**
 * شکل ردیف‌هایی که قالب FRM-RM-08 مصرف می‌کند. داده از اسکیمای mes می‌آید
 * (frm-rm-08.service.ts)؛ این فرم داده‌ی Mock ندارد.
 */
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'secondary';

/** کدهای موقت تا رسیدن کدلیست اصلی (به سرآغاز mes_frm_rm08_setup.sql نگاه کنید). */
export const QUALIFICATION: Record<number, { label: string; tone: Tone }> = {
  1: { label: 'تأییدشده', tone: 'success' },
  2: { label: 'مشروط', tone: 'warning' },
  3: { label: 'تعلیق', tone: 'danger' },
};
export const PERIOD_LABEL: Record<number, string> = { 1: 'روز', 2: 'هفته', 3: 'ماه' };
export const INVENTORY_TYPE_LABEL: Record<number, string> = { 1: 'مواد امانی', 2: 'محصول و نیمه‌ساخته' };

/** هشدار قرارداد و تأیید صلاحیت: کمتر از این تعداد روز مانده. */
export const CONTRACT_WARN_DAYS = 60;
export const QUALIFICATION_WARN_DAYS = 30;

export interface ContractorRow {
  id: number;
  code: string;
  title: string;
  city: string;
  contact: string;
  contract: string;
  contractState: string;
  contractTone: Tone;
  qualification: string;
  qualificationTone: Tone;
  materialMode: string;
  calendar: string;
  active: boolean;
  capabilityCount: number;
  inventoryCount: number;
  description: string;
}

export interface CapabilityRow {
  contractor: string;
  operation: string;
  product: string;
  isProductGroup: boolean;
  capacity: string;
  qualifiedUntil: string;
  qualificationState: string;
  qualificationTone: Tone;
  isFuture: boolean;
}

export interface RateRow {
  contractor: string;
  operation: string;
  product: string;
  isProductGroup: boolean;
  fee: string;
  change: string;
  leadTime: string;
  minOrder: string;
  validity: string;
  status: 'current' | 'future' | 'past';
  hasCapability: boolean;
  reason: string;
}

export interface InventoryRow {
  contractor: string;
  code: string;
  title: string;
  type: string;
  reference: string;
  linked: boolean;
  description: string;
}

/** یک مورد نیازمند توجه، برای بنر. */
export interface ContractorIssue {
  tone: 'danger' | 'warning';
  text: string;
}
