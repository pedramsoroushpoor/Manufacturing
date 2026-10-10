/** مدل‌های نمایشی FRM-PC-07 «رسید محصول و هویت‌بخشی» */

export interface ReceiptRow {
  id: number;
  number: string;
  date: string;
  woId: number;
  wo: string;
  opSeq: number;
  report: string;
  reportedQty: number;
  productCode: string;
  product: string;
  unit: string;
  outputType: number;
  completed: number;
  received: number;
  remained: number;
  policy: number;
  inventory: string;
  batch: string;
  qc: number | null;
  qcApproved: number | null;
  qcRejected: number | null;
  rejectedRoute: number | null;
  costShare: number | null;
  valuationRate: number | null;
  customerOwned: boolean;
  doc: string;
  note: string;
}

export interface ReconReportRow {
  woId: number;
  wo: string;
  opSeq: number;
  report: string;
  reportedAt: string;
  product: string;
  unit: string;
  reported: number;
  received: number;
  approved: number;
  rejected: number;
  pending: number | null;
  difference: number;
  ageHours: number;
  exception: number;
}

export interface ReconOutputRow {
  woId: number;
  wo: string;
  outputType: number;
  product: string;
  unit: string;
  expected: number;
  received: number;
  lastReceipt: string | null;
  exception: number;
}

export interface BatchRow {
  id: number;
  number: string;
  productCode: string;
  product: string;
  unit: string;
  woId: number;
  wo: string;
  woStatus: number;
  woType: number;
  line: string;
  mfg: string | null;
  exp: string | null;
  planned: number;
  released: number | null;
  status: number;
  customerOwned: boolean;
  owner: string;
  note: string;
  patternId: number | null;
  serialCount: number;
  received: number;
}

export interface PatternItem {
  order: number;
  type: number;
  renewal: boolean;
  length: number;
  value: string;
}

export interface PatternRow {
  id: number;
  lineId: number;
  line: string;
  group: string;
  validFrom: string | null;
  validTo: string | null;
  first: string;
  last: string;
  lastUsed: string;
  totalLength: number;
  note: string;
  items: PatternItem[];
}

export interface AttrRow {
  batchId: number;
  batch: string;
  opSeq: number;
  opTitle: string;
  opStatus: number;
  code: string;
  title: string;
  unit: string;
  action: number;
  qcGate: boolean;
  valueNumber: number | null;
  valueText: string | null;
  recordedAt: string | null;
  recordedBy: string;
  rule: string;
}

export interface SerialGroup {
  woId: number;
  wo: string;
  batch: string;
  level: number;
  status: number;
  count: number;
  first: string;
  last: string;
  lastAssigned: string | null;
  patternId: number | null;
  opSeq: number | null;
}

export interface SerialPattern {
  id: number;
  number: string;
  name: string;
  text: string;
  level: number;
  counterLength: number;
  childrenPerParent: number | null;
  note: string;
}

export interface LinkRow {
  id: number;
  parentBatch: string;
  parentProduct: string;
  parentWo: string;
  childBatch: string;
  childProduct: string;
  childUnit: string;
  childWo: string;
  quantity: number;
  estimated: boolean;
  relation: number;
  note: string;
}

export interface GapRow {
  wo: string;
  batch: string;
  opSeq: number;
  product: string;
  rows: number;
  quantity: number;
  unit: string;
}

export interface LabelPart {
  templateId: number;
  code: string;
  title: string;
  field: string;
  caption: string;
  element: number;
  x: number;
  y: number;
  w: number;
  h: number;
  fontPt: number | null;
  bold: boolean;
  sort: number;
}

export interface LabelTemplate {
  id: number;
  number: string;
  name: string;
  level: number;
  width: number;
  height: number;
  group: string;
  note: string;
  parts: LabelPart[];
}

export interface TraceRow {
  level: number;
  linkId: number;
  parentBatch: string;
  parentProduct: string;
  parentWo: string;
  childBatch: string;
  childProduct: string;
  childWo: string;
  childUnit: string;
  quantity: number;
  estimated: boolean;
  relation: number;
  opSeq: number | null;
  inventory: string;
}

export interface SerialInfo {
  serial: string;
  level: number;
  status: number;
  batch: string;
  assignedAt: string | null;
  note: string;
  product: string;
  wo: string;
  opSeq: number | null;
  parent: string | null;
  parentStatus: number | null;
  childCount: number;
  children: { serial: string; level: number; status: number }[];
}

export interface Pc07Bundle {
  receipts: ReceiptRow[];
  reconReports: ReconReportRow[];
  reconOutputs: ReconOutputRow[];
  batches: BatchRow[];
  patterns: PatternRow[];
  attributes: AttrRow[];
  serials: SerialGroup[];
  serialPatterns: SerialPattern[];
  links: LinkRow[];
  gaps: GapRow[];
  templates: LabelTemplate[];
}

/** گره‌ی درخت شجره‌نامه (ساخته‌شده در کلاینت از ردیف‌های /trace) */
export interface GenNode {
  batch: string;
  product: string;
  wo: string;
  unit: string;
  quantity: number | null;
  estimated: boolean;
  relation: number;
  ops: string;
  inventory: string;
  children: GenNode[];
  depth: number;
  cyclic: boolean;
}

/** ردیف ساده‌شده‌ی SVG برچسب */
export interface LabelSvg {
  w: number;
  h: number;
  rects: { x: number; y: number; w: number; h: number; fill: string; stroke: string }[];
  texts: { x: number; y: number; size: number; bold: boolean; text: string; anchor: string; fill: string; ltr: boolean }[];
}

/** اجزای ساخته‌شده‌ی شماره‌ی بچ */
export interface PatternSegment {
  type: number;
  text: string;
  renewal: boolean;
  label: string;
}

export const ITEM_TYPE: Record<number, string> = { 1: 'متن ثابت', 2: 'سال شمسی', 3: 'ماه شمسی', 4: 'کد خط', 5: 'شمارنده' };
export const REJECTED_ROUTE: Record<number, string> = { 1: 'ضایعات', 2: 'دوباره‌کاری', 3: 'بازیافت' };
export const ATTR_ACTION: Record<number, string> = { 1: 'تعیین', 2: 'به‌روزرسانی', 3: 'تأیید (دروازه‌ی QC)' };

/** کدهای استثنای mes.GetReceiptReconciliation */
export const RECON_EXCEPTION: Record<number, string> = {
  0: 'منطبق',
  1: 'رسید بیش از گزارش',
  2: 'گزارش‌شده و رسیدنشده (بیش از ۴ ساعت)',
  3: 'رسید مشروط QC خارج از قرنطینه',
  4: 'مقدار رد بدون مسیر',
  5: 'گزارش‌شده، هنوز رسید نشده',
  6: 'خروجی جانبی دستور تکمیل‌شده رسید نشده',
};
export const reconTone = (c: number): 'success' | 'danger' | 'warning' | 'info' =>
  c === 0 ? 'success' : c === 5 ? 'info' : c === 6 ? 'warning' : 'danger';

export const RELATION_COLOR: Record<number, string> = { 1: 'var(--gng-primary)', 2: 'var(--gng-warning)', 3: 'var(--gng-teal)', 4: 'var(--gng-info)', 5: 'var(--gng-purple)' };

/** سال و ماه شمسی (عدد لاتین) برای ساخت شماره‌ی بچ */
export function persianYm(d: Date): { y: number; m: number } {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', { timeZone: 'UTC', year: 'numeric', month: 'numeric' }).formatToParts(d);
  return { y: parseInt(parts.find((p) => p.type === 'year')?.value ?? '0', 10), m: parseInt(parts.find((p) => p.type === 'month')?.value ?? '0', 10) };
}

/** متن ثابتی که حروف فارسی دارد جای‌نگه‌دار است (مثل «شیفت») */
export const isPlaceholder = (s: string): boolean => /[؀-ۿ]/.test(s);
