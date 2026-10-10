/** مدل‌های نمای FRM-PC-05 «ترمینال کف کارگاه» — نگاشت camelCase از /api/pc05/bundle */

export interface TerminalRow {
  id: number;
  number: string;
  name: string;
  line: string;
  workCenterId: number | null;
  resourceGroupId: number | null;
  station: string;
  online: boolean;
  lastSync: string | null;
  pending: number;
  autoAccept: boolean;
  threshold: number | null;
  description: string;
}

export interface QueueRow {
  terminalId: number;
  woId: number;
  woNumber: string;
  priority: number;
  batch: string;
  productCode: string;
  product: string;
  unit: string;
  opId: number;
  seq: number;
  opCode: string;
  opTitle: string;
  operationId: number;
  statusCode: number;
  toComplete: number;
  received: number;
  completed: number;
  wasted: number;
  start: string | null;
  planStart: string | null;
  planEnd: string | null;
  description: string;
  stdPerUnit: number | null;
}

export interface StopRow {
  opId: number;
  woId: number;
  code: string;
  title: string;
  group: string;
  typeCode: number;
  oeeLossCode: number | null;
  oeeLoss: string;
  oeeComponent: number | null;
  excluded: boolean;
  start: string;
  end: string | null;
  minutes: number;
  active: boolean;
  description: string;
  by: string;
  sourceCode: number;
  equipment: string;
}

export interface ReadingRow {
  opId: number;
  paramId: number;
  title: string;
  unit: string;
  target: number | null;
  min: number | null;
  max: number | null;
  critical: boolean;
  actionCode: number;
  at: string;
  value: number;
  sourceCode: number;
  out: boolean;
  comment: string;
}

export interface CheckRow {
  opId: number;
  seq: number;
  isControl: boolean;
  description: string;
  done: boolean;
  doneAt: string | null;
  doneBy: string;
  doc: string;
  instruction: string;
  rev: number | null;
  mediaCode: number | null;
  file: string;
  instructionText: string;
  tools: string;
  uniforms: string;
}

export interface DeviceRow {
  id: number;
  plc: string;
  tag: string;
  typeCode: number;
  item: string;
  equipment: string;
  woId: number;
  woNumber: string;
  refNumber: string;
  result: number;
  userValue: number | null;
  from: string;
  to: string | null;
  applied: boolean;
  note: string;
  deviation: number | null;
}

/** ضایعات سطح عملیات (همان جدول PC-04 — F-PC-070، 071) */
export interface OpWasteRow {
  woId: number;
  seq: number;
  qty: number;
  isSetup: boolean;
  material: boolean;
  reason: string;
  parent: string;
}

export interface Pc05Bundle {
  terminals: TerminalRow[];
  queue: QueueRow[];
  stoppages: StopRow[];
  readings: ReadingRow[];
  checklist: CheckRow[];
  device: DeviceRow[];
}

/** کدهای موقت mes_frm_me01 / pc05 */
export const PARAM_ACTION: Record<number, string> = { 1: 'هشدار', 2: 'توقف خط' };
export const READING_SOURCE: Record<number, string> = { 1: 'دستی', 2: 'PLC/حسگر' };
export const MEDIA: Record<number, { label: string; icon: string }> = {
  1: { label: 'متن', icon: 'pi pi-align-right' },
  2: { label: 'تصویر', icon: 'pi pi-image' },
  3: { label: 'ویدئو', icon: 'pi pi-video' },
  4: { label: 'PDF', icon: 'pi pi-file-pdf' },
};
export const OEE_COMPONENT: Record<number, string> = { 1: 'دسترس‌پذیری', 2: 'عملکرد', 3: 'کیفیت' };
export const PLC_ITEM_TYPE: Record<number, string> = { 1: 'شمارنده‌ی تولید', 2: 'کنتور انرژی', 3: 'پارامتر فرایند', 4: 'وضعیت توقف' };
