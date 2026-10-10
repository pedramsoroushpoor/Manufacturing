/** مدل‌های نمای FRM-PC-04 «گزارش تولید» — نگاشت camelCase از /api/pc04/bundle */

export interface WoRow {
  id: number;
  number: string;
  name: string;
  typeCode: number;
  statusCode: number;
  product: string;
  unit: string;
  quantity: number;
  line: string;
  shift: string;
  plannedComplete: string | null;
  due: string | null;
  refNumber: string;
  customer: string;
  currentOp: string;
  wastedTotal: number;
  opCount: number;
  opsDone: number;
}

export interface OpRow {
  woId: number;
  id: number;
  seq: number;
  title: string;
  statusCode: number;
  resource: string;
  toComplete: number;
  received: number;
  completed: number;
  wasted: number;
  rework: number;
  start: string | null;
  end: string | null;
  planStart: string | null;
  planEnd: string | null;
  stdMinutes: number | null;
}

export interface ReportRow {
  woId: number;
  woNumber: string;
  opId: number;
  seq: number;
  opTitle: string;
  outputId: number;
  number: string;
  start: string;
  end: string | null;
  duration: number;
  persons: number;
  completed: number;
  wasted: number;
  rework: number;
  transferred: number;
  yieldPct: number | null;
  sourceCode: number;
  by: string;
  description: string;
  shiftCode: string;
  unit: string;
}

export interface LaborRow {
  outputId: number;
  woId: number;
  code: string;
  name: string;
  duration: number;
  completed: number;
  wasted: number;
  share: number;
  activity: string;
}

export interface WasteRow {
  outputId: number;
  woId: number;
  seq: number;
  qty: number;
  typeCode: number;
  isSetup: boolean;
  reasonCode: string;
  reason: string;
  parent: string;
  description: string;
}

export interface ReworkRow {
  outputId: number;
  woId: number;
  seq: number;
  toRepair: number;
  repaired: number;
  remained: number;
  reason: string;
  description: string;
}

export interface CapacityRow {
  outputId: number;
  woId: number;
  seq: number;
  title: string;
  unit: string;
  qty: number;
  std: number | null;
  sourceCode: number;
  description: string;
}

export interface ShiftRow {
  id: number;
  date: string;
  title: string;
  from: number;
  to: number;
  line: string;
  supervisor: string;
  next: string;
  handover: string | null;
  statusCode: number;
  summary: string;
  equipment: string;
  issues: string;
}

export interface WipRow {
  shiftId: number;
  woNumber: string;
  opTitle: string;
  qty: number;
  unit: string;
  description: string;
}

export interface Pc04Bundle {
  orders: WoRow[];
  operations: OpRow[];
  reports: ReportRow[];
  labor: LaborRow[];
  waste: WasteRow[];
  rework: ReworkRow[];
  capacity: CapacityRow[];
  shifts: ShiftRow[];
  wip: WipRow[];
}

/** یک بلوک روی محور زمان (راست = قدیمی‌تر؛ صفحه راست‌به‌چپ است) */
export interface TimeBlock {
  right: number;
  width: number;
  label: string;
  tone: string;
  key: string;
  title: string;
}

export interface Tick {
  right: number;
  label: string;
}

/** سقف معقول مصرف در هر ساعت کارکرد (برای کشف داده‌ی نامعقول) */
export const PLAUSIBLE_PER_HOUR: Record<string, number> = { STM: 2000, ELC: 250 };

export const SOURCE_CLASS: Record<number, string> = { 1: 'src-office', 2: 'src-terminal', 3: 'src-plc', 4: 'src-calc' };

export const ms = (iso: string | null | undefined): number => (iso ? new Date(iso).getTime() : NaN);
