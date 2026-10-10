/**
 * مدل‌های FRM-PC-13 «اتاق جلسه‌ی کنترل تولید».
 * همه‌ی زمان‌ها پس از نگاشت به عدد میلی‌ثانیه (UTC = زمان محلی سناریو) تبدیل می‌شوند تا محاسبه‌ی زمانی ارزان باشد.
 */
import { faDuration, faInt, faNum } from './pc-shared';

export const MIN = 60000;
export const HOUR = 3600000;
export const DAY = 86400000;

// ───────── ردیف‌های خام (نگاشت‌شده) ─────────

export interface Fact {
  id: number; wo: string; title: string; type: number; status: number; priority: number; lineId: number; line: string;
  productCode: string; product: string; unit: string; qty: number; batch: string; customer: string; refId: number | null; refWo: string;
  planRelease: number | null; planComplete: number | null; due: number | null; actRelease: number | null; actComplete: number | null; closeDate: number | null;
  version: string; opsTotal: number; opsDone: number; opsRunning: number; opsPaused: number; opsOutsourced: number;
  firstStart: number | null; lastEnd: number | null; stdMin: number; lastSeq: number | null; good: number;
  wasted: number; rework: number; stopMin: number; openStops: number; stopCount: number; received: number; qcPending: number; rejected: number;
  ncCost: number; ncPending: number; ncCases: number; reports: number; lastReportAt: number | null; requests: string[];
  contractor: string; contractorReady: number | null; forecastEnd: number | null; forecastDelay: number; deviations: number;
}

export type EvKind =
  | 'REQ' | 'APPROVE' | 'RELEASE' | 'COMPLETE' | 'CLOSE' | 'CHANGE' | 'OP_START' | 'OP_END' | 'REPORT' | 'STOP' | 'PARAM' | 'KIT'
  | 'EXCESS' | 'RECEIPT' | 'NC' | 'SHIP' | 'CTR' | 'DEVIATION' | 'SHIFT';

export interface Ev {
  i: number; t: number; kind: EvKind; sev: number; woId: number | null; wo: string; lineId: number | null; line: string; seq: number | null;
  title: string; detail: string; qty: number | null; min: number | null; ref: string;
}

export interface DailyRow { t: number; lineId: number; line: string; reports: number; orders: number; completed: number; wasted: number; run: number; stops: number; stopMin: number; ncCost: number }

export interface AlertRow {
  key: string; ruleType: number; ruleCode: string; ruleTitle: string; severity: number; owner: string; escMin: number; escOwner: string; woId: number | null; wo: string;
  opSeq: number | null; line: string; raisedAt: number; measured: number | null; limit: number | null; unit: string; subject: string; detail: string; status: number;
  ageMin: number; escalated: boolean;
}

export interface DeviationRow {
  id: number; woId: number; wo: string; opSeq: number | null; causeCode: string; cause: string; causeParent: string; typeCode: number; planned: string; actual: string;
  recordedAt: number; recordedBy: string; caTitle: string; caOwner: string; caDue: number | null; caStatus: number | null; caRef: string; description: string;
}

export interface CopqRow { line: string; ncType: number; reason: string; reasonCode: string; wo: string; decidedAt: number | null; source: number; cases: number; cost: number; recovered: number; penalty: number }

export interface VarianceRow {
  woId: number; opSeq: number; product: string; unit: string; standard: number; actual: number; min: number | null; max: number | null; activeIngredient: boolean; customerMaterial: boolean;
}

export interface DispositionRow {
  id: number; number: string; source: number; woId: number; wo: string; opSeq: number | null; opTitle: string; reportedAt: number | null; product: string; unit: string;
  qty: number; ncType: number; reason: string; decision: number; decidedAt: number | null; targetWo: string; contractor: string; penalty: number; cost: number;
  recovered: number; description: string; customerOwned: boolean;
}

export interface RequestRow {
  id: number; number: string; date: number | null; origin: number; priority: number; product: string; unit: string; qty: number; need: number | null; requester: string;
  customer: string; status: number; description: string; ordered: number;
}

export interface MaterialRow {
  woId: number; seq: number | null; productCode: string; product: string; unit: string; standard: number; planKit: number; actualKit: number | null; consumed: number | null;
  returned: number | null; excess: number | null; shortage: number | null; status: number; customer: boolean; available: number | null; reserved: number | null;
  inTransit: number | null; nextArrival: number | null;
}

export interface OperationRow {
  woId: number; seq: number; title: string; status: number; outsourced: boolean; resource: string; toComplete: number; completed: number; wasted: number;
  start: number | null; end: number | null; planStart: number | null; planEnd: number | null; std: number;
}

export interface ReconReportRow { woId: number; wo: string; seq: number; report: string; reportedAt: number | null; product: string; unit: string; reported: number; received: number; pending: number; difference: number; ageHours: number; exception: number }
export interface ReconOutputRow { woId: number; wo: string; outputType: number; product: string; unit: string; expected: number; received: number; exception: number }

export interface SubcontractRow {
  woId: number; wo: string; opSeq: number; opTitle: string; toComplete: number; contractor: string; sentAt: number | null; expectedReturn: number | null; fee: number;
  feeUnit: string; leadDays: number; stage: number; progressAt: number | null; progressCompleted: number; progressWasted: number; expectedReady: number | null;
  receivedGood: number; accepted: number; receivedDefective: number; declaredWaste: number; lastReceipt: number | null; feePayable: number; delayDays: number;
  overdue: boolean; nextTitle: string;
}

export interface ReadinessRow {
  woId: number; wo: string; status: number; product: string; completedAt: number | null; closedAt: number | null; opsOpen: number; consumptionMissing: number;
  excessNotReturned: number; pendingDispositions: number; unexecutedDispositions: number; outputsNotReceived: number; qcPending: number; canClose: boolean;
}

export interface CloseEventRow { id: number; woId: number; wo: string; type: number; at: number; by: string; reason: string; approval: number | null; approver: string; description: string }

export interface Pc13Bundle {
  from: string; to: string;
  facts: Fact[]; events: Ev[]; daily: DailyRow[]; alerts: AlertRow[]; deviations: DeviationRow[]; copq: CopqRow[]; variance: VarianceRow[];
  dispositions: DispositionRow[]; requests: RequestRow[]; materials: MaterialRow[]; operations: OperationRow[]; reconReports: ReconReportRow[];
  reconOutputs: ReconOutputRow[]; subcontract: SubcontractRow[]; readiness: ReadinessRow[]; closeEvents: CloseEventRow[];
}

// ───────── مدل‌های نمایشی ─────────

export interface Scope { from: number; to: number; mode: 'range' | 'order'; woId: number | null; lines: number[]; types: number[]; customer: string | null }

export interface KpiTile { key: string; label: string; value: string; unit: string; sub: string; delta: string; deltaTone: 'good' | 'bad' | 'flat' | 'none'; tone: string; hint: string }

export interface LineTile { lineId: number; line: string; earned: string; good: string; avail: number | null; availLabel: string; run: string; stop: string }

export interface HeatCell { day: number; lineId: number; value: number; label: string; level: number; future: boolean; on: boolean }
export interface HeatRow { lineId: number; line: string; cells: HeatCell[]; total: string }
export interface HeatDay { t: number; label: string; weekday: string; today: boolean }

export interface DnaTick { x: number; w: number; color: string; t: number; tip: string; tall: boolean }
export interface DnaRow {
  id: number; wo: string; label: string; line: string; status: string; planX: number; planW: number; dueX: number | null; dueOut: '' | 'before' | 'after';
  dueLabel: string; ticks: DnaTick[]; rough: number; roughLabel: string; progress: number; late: boolean; focus: boolean;
}

export interface WaterStep { label: string; value: number; base: number; kind: 'total' | 'loss' | 'result'; text: string; hint: string }

export interface RiskPoint { id: number; wo: string; x: number; y: number; r: number; slackH: number; remaining: number; late: boolean; tip: string; label: string }

export interface WhatIfParams { repairH: number; rates: Record<number, number>; extraShift: Record<number, boolean>; approveAll: boolean; decisionWaitH: number; materialGate: boolean }

export interface ForecastRow {
  id: number; wo: string; line: string; lineId: number; due: number | null; end: number; slackH: number; late: boolean; remainingPct: number; noStd: boolean;
  reasons: string[]; api: number | null;
}
export interface WhatIfRow { id: number; wo: string; line: string; due: string; before: string; after: string; deltaH: number; deltaLabel: string; flip: '' | 'saved' | 'broken'; lateAfter: boolean; reasons: string }

export type Area = 'prod' | 'quality' | 'material' | 'plan' | 'outside' | 'data';
export type SixM = 'machine' | 'material' | 'method' | 'measure' | 'man' | 'env';

export interface Problem {
  key: string; source: string; area: Area; m6: SixM; title: string; story: string; owner: string; decision: string; woId: number | null; wo: string; lineId: number | null;
  line: string; sev: number; money: number; delayMin: number; customer: string; raisedAt: number; ageH: number; score: number; scoreTip: string; evidence: Ev[]; escalated: boolean;
}

export interface ProblemGroup { key: string; title: string; items: Problem[]; score: number }

export interface AgendaLine { text: string; tone: 'danger' | 'warning' | 'info' | 'success' | 'muted'; woId: number | null; meta: string }
export interface AgendaItem { id: string; no: number; title: string; minutes: number; lines: AgendaLine[]; visual: 'kpi' | 'problems' | 'risk' | 'ca' | 'decisions' | 'watch'; empty: string }

export interface JBar { x: number; w: number; label: string; cls: string; tip: string; ev: Ev | null; point: boolean }
export interface JLane { key: string; title: string; rows: JBar[][] }
export interface JAxisTick { x: number; label: string; major: boolean }

export interface MinutesDoc { title: string; scope: string; date: string; items: AgendaItem[]; notes: Record<string, string>; owners: string[] }

// ───────── ثابت‌ها ─────────

export const KIND_LABEL: Record<EvKind, string> = {
  REQ: 'درخواست', APPROVE: 'تأیید', RELEASE: 'آزادسازی', COMPLETE: 'تکمیل', CLOSE: 'بستن/بازگشایی', CHANGE: 'تغییر', OP_START: 'شروع عملیات', OP_END: 'پایان عملیات',
  REPORT: 'گزارش تولید', STOP: 'توقف', PARAM: 'پارامتر', KIT: 'کیت مواد', EXCESS: 'مازاد', RECEIPT: 'رسید', NC: 'عدم‌انطباق', SHIP: 'حمل', CTR: 'پیمانکار',
  DEVIATION: 'انحراف', SHIFT: 'تحویل شیفت',
};

/** رنگ تیک‌های DNA و مسیر سفارش */
export const KIND_COLOR: Record<EvKind, string> = {
  STOP: '#ff5d5d', NC: '#ff9f43', PARAM: '#b57cff', RECEIPT: '#3ddc84', DEVIATION: '#ffffff', CHANGE: '#ffd43b', EXCESS: '#ff9f43', KIT: '#22c1c3',
  SHIP: '#4dabf7', CTR: '#4dabf7', RELEASE: '#74c0fc', COMPLETE: '#3ddc84', CLOSE: '#adb5bd', REPORT: '#5c7080', OP_START: '#5c7080', OP_END: '#5c7080',
  REQ: '#8a9bb0', APPROVE: '#8a9bb0', SHIFT: '#8a9bb0',
};

export const SEV_COLOR = ['#3d5368', '#4dabf7', '#ffb547', '#ff5d5d'];

export const AREA_LABEL: Record<Area, string> = { prod: 'تولید و تجهیز', quality: 'کیفیت', material: 'مواد', plan: 'برنامه و تحویل', outside: 'برون‌سپاری و کارمزدی', data: 'داده و رسید' };
export const AREA_COLOR: Record<Area, string> = { prod: '#ff5d5d', quality: '#ff9f43', material: '#22c1c3', plan: '#ffd43b', outside: '#4dabf7', data: '#b57cff' };
export const M6_LABEL: Record<SixM, string> = { machine: 'ماشین', material: 'مواد', method: 'روش', measure: 'اندازه‌گیری', man: 'نیروی انسانی', env: 'محیط' };

export const HEAT_METRICS = [
  { value: 'prod', label: 'تولید' },
  { value: 'stop', label: 'دقیقه‌ی توقف' },
  { value: 'waste', label: 'ضایعات' },
  { value: 'copq', label: 'هزینه‌ی کیفیت' },
  { value: 'reports', label: 'تعداد گزارش' },
] as const;
export type HeatMetric = (typeof HEAT_METRICS)[number]['value'];

export const IMPACT_FORMULA =
  'امتیاز اثر = ۱۰×شدت (۱ تا ۳) + میلیون ریال پول درگیر (سقف ۳۰) + ۲×ساعت تأخیر (سقف ۳۰) + ۱۰ اگر سفارش مشتری است + سن به ساعت ÷ ۶ (سقف ۱۰)';

export const WHATIF_FORMULA =
  'پایان = max(اکنون، آزادسازی برنامه‌ای) + [بیشینه‌ی دقیقه‌ی استاندارد باقی‌مانده‌ی عملیات‌ها (گلوگاه) ÷ (۱ + نرخ خط) ÷ (۱٫۵ اگر شیفت اضافه)] + توقف باز (N ساعت) + انتظار منبعِ اشغال + انتظار تصمیم‌های معوق؛ و نه زودتر از آماده‌شدن پیمانکار یا رسیدن ماده‌ی کسری.';

export const RECON_EXCEPTION: Record<number, string> = {
  1: 'رسید بیش از گزارش', 2: 'گزارش‌شده و رسیدنشده (بیش از ۴ ساعت)', 3: 'رسید مشروط QC خارج از قرنطینه', 4: 'مقدار رد بدون مسیر', 5: 'گزارش‌شده، هنوز رسید نشده',
  6: 'خروجی جانبی دستور تکمیل‌شده رسید نشده',
};

// ───────── قالب‌بندی (ورودی میلی‌ثانیه) ─────────

const iso = (ms: number): string => new Date(ms).toISOString();

/** «۱۷ مهر» */
export const faDM = (ms: number | null): string =>
  ms === null ? '—' : new Date(ms).toLocaleDateString('fa-IR-u-ca-persian', { timeZone: 'UTC', day: 'numeric', month: 'long' });

/** «جمعه» */
export const faWeekday = (ms: number): string => new Date(ms).toLocaleDateString('fa-IR-u-ca-persian', { timeZone: 'UTC', weekday: 'long' });

/** «۱۴:۰۰» */
export const faHM = (ms: number | null): string =>
  ms === null ? '—' : new Date(ms).toLocaleTimeString('fa-IR', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false });

/** «۱۶ مهر ۱۴:۰۰» */
export const faDMT = (ms: number | null): string => (ms === null ? '—' : `${faDM(ms)} ${faHM(ms)}`);

/** «۱۱ تا ۱۷ مهر» */
export function faRange(from: number, toExclusive: number): string {
  const last = Math.max(from, toExclusive - 1);
  const a = new Date(from).toLocaleDateString('fa-IR-u-ca-persian', { timeZone: 'UTC', month: 'long' });
  const b = new Date(last).toLocaleDateString('fa-IR-u-ca-persian', { timeZone: 'UTC', month: 'long' });
  const d1 = new Date(from).toLocaleDateString('fa-IR-u-ca-persian', { timeZone: 'UTC', day: 'numeric' });
  if (Math.floor(from / DAY) === Math.floor(last / DAY)) return faDM(from);
  return a === b ? `${d1} تا ${faDM(last)}` : `${faDM(from)} تا ${faDM(last)}`;
}

/** «۳۵٫۹ میلیون ریال» */
export function faMoney(rial: number): string {
  const a = Math.abs(rial);
  if (a >= 1e9) return `${faNum(rial / 1e9, 2)} میلیارد ریال`;
  if (a >= 1e6) return `${faNum(rial / 1e6, 1)} میلیون ریال`;
  return `${faInt(rial)} ریال`;
}

/** «۱٫۵ ساعت» از ساعت؛ منفی = «−» */
export function faHours(h: number): string {
  return `${h < 0 ? '−' : ''}${faNum(Math.abs(h), Math.abs(h) < 10 ? 1 : 0)} ساعت`;
}

export const faDur = (min: number): string => faDuration(min);

/** کلید روز «2026-10-09» */
export const dayKey = (ms: number): string => iso(ms).slice(0, 10);
export const dayStart = (ms: number): number => Math.floor(ms / DAY) * DAY;
export const parseDay = (s: string): number | null => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.parse(`${s}T00:00:00Z`) : null);

/** «خط قرص‌سازی ۲» ← «خط ۲» */
export const shortLine = (title: string): string => {
  const m = /(\S+)\s*$/.exec(title || '');
  return m ? `خط ${m[1]}` : title;
};

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
