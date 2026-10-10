/** مدل‌های نمای FRM-PC-06 «مصرف مواد» — نگاشت camelCase از /api/pc06/bundle */

export interface ConsRow {
  woId: number;
  id: number;
  seq: number;
  opTitle: string;
  productId: number;
  productCode: string;
  product: string;
  unit: string;
  group: string;
  consumed: number;
  theoretical: number | null;
  potency: number | null;
  batch: string;
  modeCode: number;
  shortageCode: number;
  shortage: number | null;
  isReversal: boolean;
  reversedId: number | null;
  recovered: boolean;
  customer: boolean;
  doc: string;
  docPattern: string;
  start: string | null;
  description: string;
  report: string;
  substitute: string;
}

export interface VarRow {
  woId: number;
  materialId: number;
  seq: number;
  product: string;
  unit: string;
  plannedKit: number;
  actualKit: number | null;
  toComplete: number;
  produced: number;
  standard: number;
  actual: number;
  minPct: number | null;
  maxPct: number | null;
  active: boolean;
  customer: boolean;
  controlCode: number | null;
  policyCode: number | null;
}

export interface RecoveredRow {
  batch: string;
  product: string;
  code: string;
  source: string;
  onHand: number;
  purity: number | null;
  minPurity: number | null;
  cycle: number | null;
  maxCycles: number | null;
  expire: string | null;
  requiresQc: boolean;
  qcCode: number;
  blockReason: string;
  maxMix: number | null;
}

/** ردیف مواد دستور از PC-02 (برای مواد q.s. بدون ثبت مصرف) */
export interface WoMaterialRow {
  woId: number;
  product: string;
  unit: string;
  quantumSatis: boolean;
  consumed: number | null;
  statusCode: number;
}

export interface WoHead {
  id: number;
  number: string;
  name: string;
  typeCode: number;
  statusCode: number;
  customer: string;
}

export interface Pc06Bundle {
  consumption: ConsRow[];
  variance: VarRow[];
  recovered: RecoveredRow[];
}

export interface Flag {
  woId: number;
  tone: 'danger' | 'warning';
  text: string;
}

/** کدهای موقت mes_frm_me06 / pc06 */
export const CONTROL: Record<number, string> = { 1: 'بدون کنترل', 2: 'هشدار', 3: 'منع' };
export const POLICY: Record<number, string> = { 1: 'دستی', 2: 'Backflush پایان عملیات', 3: 'Backflush در رسید', 4: 'ترکیبی' };
export const SHORTAGE: Record<number, string> = { 1: 'عادی', 2: 'موجودی منفی', 3: 'ثبت جزئی + صف اصلاح' };
export const MODE_TONE: Record<number, 'info' | 'warning' | 'success'> = { 1: 'info', 2: 'warning', 3: 'success' };

/** «ALF-3310، ALF-3310» ← «ALF-3310» */
export const dedupeBatch = (s: string | null | undefined): string => [...new Set((s ?? '').split('،').map((x) => x.trim()).filter(Boolean))].join('، ');
