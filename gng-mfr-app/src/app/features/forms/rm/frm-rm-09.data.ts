/**
 * شکل ردیف‌هایی که قالب FRM-RM-09 مصرف می‌کند. داده از اسکیمای mes می‌آید
 * (frm-rm-09.service.ts)؛ این فرم داده‌ی Mock ندارد.
 */
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'secondary';

/** کدهای موقت تا رسیدن کدلیست اصلی (به سرآغاز mes_frm_rm09_setup.sql نگاه کنید). */
export const ACTIVITY_LEVEL: Record<number, string> = { 1: 'سطح واحد', 2: 'سطح بچ', 3: 'سطح محصول', 4: 'سطح کارخانه' };
export const COLLECTION_EVENT: Record<number, string> = { 1: 'ثبت گزارش تولید', 2: 'بستن شیفت', 3: 'بستن دستور' };
export const COLLECTION_METHOD: Record<number, string> = { 1: 'دستی', 2: 'از PLC', 3: 'محاسباتی' };
export const RESOURCE_KIND: Record<number, string> = { 1: 'تجهیز', 2: 'گروه منبع', 3: 'کارکرد / انرژی' };

export interface ActivityRow {
  code: string;
  title: string;
  level: string;
  operations: string;
  resources: string;
  costCenters: string;
  driverCount: number;
  active: boolean;
  description: string;
}

export interface DriverRow {
  code: string;
  title: string;
  activity: string;
  type: string;
  unit: string;
  collection: string;
  event: string;
  eventName: string;
  eventActive: boolean;
  typeAllowed: boolean;
  description: string;
}

export interface CapacityTypeRow {
  code: string;
  title: string;
  unit: string;
  collection: string;
  isCostDriver: boolean;
  fixedBasis: boolean;
  drivers: string;
  active: boolean;
  /** کارکرد مجاز نیست ولی محرکی رویش ساخته شده. */
  misused: boolean;
}

/** زنجیره‌ی «مرکز هزینه ← فعالیت ← محرک» برای نمودار. */
export interface CostChainRow {
  costCenters: string;
  activity: string;
  drivers: string;
}

export interface AllocationLine {
  costCenter: string;
  basis: string;
  share: number | null;
  description: string;
}

export interface AllocationGroup {
  resource: string;
  kind: string;
  method: 'fixed' | 'actual' | 'mixed';
  lines: AllocationLine[];
  total: number | null;
  ok: boolean;
}
