/** FRM-PC-12 — مدل کنسول پایش و بستن دستور (روی /api/pc12/bundle و /api/pc12/costing). */

export interface LineKpi {
  id: number; code: string; title: string; running: number; paused: number; openStops: number;
  a: number; p: number; q: number; oee: number; planMin: number; stopMin: number; shiftStart: string | null; asOf: string | null;
}

export interface Station {
  key: string; lineId: number; title: string; code: string; seqNo: number; andon: number; isGroup: boolean;
  woId: number | null; wo: string; opSeq: number | null; opTitle: string; toComplete: number | null; completed: number | null; wasted: number | null;
  start: string | null; stopTitle: string; stopSince: string | null; runningCount: number; runningOrders: string[]; oee: number | null;
}

export interface ActiveOrder {
  id: number; wo: string; typeCode: number; statusCode: number; line: string; product: string; unit: string; qty: number;
  planned: string | null; due: string | null; customer: string; lastSeq: number | null; lastCompleted: number | null; lastToComplete: number | null;
  progress: number | null; opsDone: number; opsTotal: number; forecastEnd: string | null; delayMin: number;
}

export interface OpenStop {
  id: number; wo: string; opSeq: number; opTitle: string; description: string; start: string | null; openMin: number; by: string; line: string;
}

export interface Alert {
  key: string; ruleType: number; ruleId: number; ruleCode: string; ruleTitle: string; severity: number; channel: number; owner: string;
  escMin: number; escOwner: string; woId: number | null; wo: string; opSeq: number | null; line: string; raisedAt: string | null;
  measured: number | null; limit: number | null; unit: string; subject: string; detail: string; status: number; ackAt: string | null;
  ackBy: string; assignedTo: string; note: string; ageMin: number; escalated: boolean;
}

export interface Rule {
  id: number; number: string; name: string; type: number; threshold: number | null; unit: string; severity: number; channel: number;
  owner: string; escMin: number; escOwner: string; active: boolean; description: string;
}

export interface Deviation {
  id: number; woId: number; wo: string; opSeq: number | null; causeId: number; causeCode: string; cause: string; causeParent: string; typeCode: number;
  planned: string; actual: string; recordedAt: string | null; recordedBy: string; caTitle: string; caOwner: string; caDue: string | null; caStatus: number | null;
  caRef: string; description: string;
}

export interface Cause { id: number; number: string; name: string; parentId: number | null; typeCode: number; sort: number; usage: number }

export interface WipRow {
  woId: number; wo: string; typeCode: number; line: string; lineId: number; seq: number; opTitle: string; statusCode: number; outsourced: boolean; unit: string;
  toComplete: number; received: number; completed: number; wasted: number; rework: number; inProcess: number; inProcessPct: number; stageFraction: number;
}

export interface Readiness {
  woId: number; wo: string; typeCode: number; statusCode: number; product: string; batch: string; completedAt: string | null; closedAt: string | null;
  opsOpen: number; consumptionMissing: number; excessNotReturned: number; pendingDispositions: number; unexecutedDispositions: number;
  outputsNotReceived: number; qcPending: number; suspendedDays: number | null; autoCloseDays: number | null; canClose: boolean; autoCloseCandidate: boolean;
}

export interface CloseEvent {
  id: number; woId: number; wo: string; typeCode: number; at: string | null; by: string; reason: string; approvalCode: number | null; approver: string;
  costingNumber: string; costingStatus: number | null; description: string;
}

export interface Pc12Bundle {
  lines: LineKpi[]; stations: Station[]; orders: ActiveOrder[]; stops: OpenStop[]; alerts: Alert[]; rules: Rule[];
  deviations: Deviation[]; causes: Cause[]; wip: WipRow[]; readiness: Readiness[]; events: CloseEvent[];
}

export interface CostingMaterial { code: string; title: string; unit: string; customer: boolean; standard: number; actual: number; returned: number }
export interface CostingResource { code: string; title: string; unit: string; quantity: number }
export interface CostingOutput { typeCode: number; code: string; title: string; unit: string; batch: string; received: number; rejected: number; share: number | null; rate: number | null }
export interface CostingHeader {
  woId: number; wo: string; typeCode: number; statusCode: number; productCode: string; product: string; unit: string; plannedQty: number; batch: string;
  version: string; lineCode: string; releasedAt: string | null; completedAt: string | null; closedAt: string | null; customer: string;
  refWoId: number | null; wastedTotal: number; ncCost: number;
}
export interface CostingEvent { header: CostingHeader | null; materials: CostingMaterial[]; resources: CostingResource[]; outputs: CostingOutput[]; raw: unknown }

/** یک بند چک‌لیست بستن */
export interface CloseCheck { key: keyof Readiness; label: string; hint: string }

export const CLOSE_CHECKS: CloseCheck[] = [
  { key: 'opsOpen', label: 'عملیات تکمیل‌نشده', hint: 'همه‌ی عملیات‌ها تکمیل شده باشند' },
  { key: 'consumptionMissing', label: 'مصرف ثبت‌نشده', hint: 'مصرف همه‌ی اقلام کیت ثبت شده باشد' },
  { key: 'excessNotReturned', label: 'مازاد برگشت‌نخورده', hint: 'مازاد پای کار به انبار برگشته باشد' },
  { key: 'pendingDispositions', label: 'نامنطبق بی‌تصمیم', hint: 'برای همه‌ی نامنطبق‌ها تصمیم گرفته شده باشد' },
  { key: 'unexecutedDispositions', label: 'تصمیم اجرانشده', hint: 'تصمیم‌ها (درجه‌دو، اسقاط…) اجرا شده باشند' },
  { key: 'outputsNotReceived', label: 'خروجی رسیدنشده', hint: 'محصول، هم‌زاد و جانبی رسید انبار خورده باشند' },
  { key: 'qcPending', label: 'QC در انتظار', hint: 'رسیدها از QC تعیین وضعیت شده باشند' },
];

export const RULE_TYPE: Record<number, string> = {
  1: 'انحراف مصرف', 2: 'تأخیر دستور', 3: 'ضایعات', 4: 'توقف طولانی', 5: 'کسری پای کار', 6: 'هم‌پوشانی ایستگاه',
  7: 'نرخ بازیابی', 8: 'رسید بیش از گزارش', 9: 'تأخیر پیمانکار', 10: 'شکاف موازنه', 11: 'پایانه‌ی برون‌خط',
};
export const RULE_ICON: Record<number, string> = {
  1: 'pi-chart-line', 2: 'pi-clock', 3: 'pi-trash', 4: 'pi-stop-circle', 5: 'pi-box', 6: 'pi-clone', 7: 'pi-replay', 8: 'pi-inbox', 9: 'pi-truck', 10: 'pi-sliders-h', 11: 'pi-wifi',
};
export const CHANNEL_ICON: Record<number, string> = { 1: 'pi-desktop', 2: 'pi-mobile', 3: 'pi-envelope', 4: 'pi-megaphone' };
export const DEVIATION_TYPE: Record<number, string> = { 1: 'مقداری', 2: 'زمانی', 3: 'ترتیب' };
export const EVENT_TYPE: Record<number, string> = { 1: 'بستن', 2: 'بستن خودکار', 3: 'درخواست بازگشایی', 4: 'بازگشایی تأییدشده' };
export const COSTING_STATUS: Record<number, string> = { 1: 'آماده‌ی ارسال', 2: 'ارسال‌شده', 3: 'تأیید بهای تمام‌شده' };
export const APPROVAL_STATUS: Record<number, string> = { 1: 'منتظر تأیید', 2: 'تأییدشده', 3: 'ردشده' };

/** «۰۰:۵۰:۱۲» برای شمارنده‌ی زنده */
export function faClock(minutes: number): string {
  const sec = Math.max(0, Math.floor(minutes * 60));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const p = (x: number) => x.toLocaleString('fa-IR', { minimumIntegerDigits: 2, useGrouping: false });
  return `${p(h)}:${p(m)}:${p(s)}`;
}
