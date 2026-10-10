import { WindowDay } from './rm-time';

/**
 * شکل ردیف‌هایی که قالب FRM-RM-06 مصرف می‌کند. داده از اسکیمای mes می‌آید
 * (frm-rm-06.service.ts)؛ این فرم داده‌ی Mock ندارد.
 */
export type VersionStatus = 'current' | 'future';

export const VERSION_LABEL: Record<VersionStatus, string> = {
  current: 'جاری',
  future: 'آینده',
};

/** کدهای موقت تا رسیدن کدلیست اصلی (به سرآغاز mes_frm_rm06_setup.sql نگاه کنید). */
export const BASIS_LABEL: Record<number, string> = { 1: 'زمان‌محور', 2: 'نرخی', 3: 'ثابت / فیزیکی' };
export const COLLECTION_LABEL: Record<number, string> = { 1: 'دستی', 2: 'از PLC', 3: 'محاسباتی' };

export interface CapacityTypeRow {
  code: string;
  title: string;
  unit: string;
  basis: string;
  collection: string;
  collectionDetail: string;
  builtIn: boolean;
  legacy: string;
  active: boolean;
  resourceCount: number;
  rateCount: number;
}

export interface CapacityRow {
  resource: string;
  isGroup: boolean;
  line: string;
  type: string;
  basis: string;
  defined: string;
  effective: string;
  validity: string;
  status: VersionStatus;
  reason: string;
}

export interface AvailabilityRow {
  resource: string;
  isGroup: boolean;
  line: string;
  type: string;
  count: string;
  availPercent: string;
  productivityPercent: string;
  downtime: string;
  status: VersionStatus;
  /** بخشی از واحدها خارج از دسترس است. */
  short: boolean;
}

export interface ProductRateRow {
  resource: string;
  isGroup: boolean;
  line: string;
  product: string;
  isProductGroup: boolean;
  rate: string;
  efficiency: string;
  effectiveRate: string;
  validity: string;
  status: VersionStatus;
}

export type LoadSeverity = 'ok' | 'warn' | 'over' | 'nocap' | 'idle';

export interface LoadCell {
  percent: number | null;
  severity: LoadSeverity;
  hint: string;
}

export interface LoadRow {
  resource: string;
  isGroup: boolean;
  line: string;
  type: string;
  unit: string;
  capacity: string;
  load: string;
  /** null یعنی برای این بار ظرفیتی تعریف نشده. */
  percent: number | null;
  severity: LoadSeverity;
  hasLoad: boolean;
  cells: LoadCell[];
}

export interface LoadGrid {
  days: WindowDay[];
  rows: LoadRow[];
}

export interface HistoryRow {
  date: string;
  kind: string;
  resource: string;
  line: string;
  target: string;
  detail: string;
  value: string;
  previous: string;
  change: string;
  changeTone: 'up' | 'down' | 'none';
  reason: string;
  changedBy: string;
  isFuture: boolean;
}
