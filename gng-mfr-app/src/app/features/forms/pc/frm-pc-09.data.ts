/** مدل‌های نمایشی FRM-PC-09 «ضایعات، دوباره‌کاری و بازیافت» */

export interface Disposition {
  id: number;
  number: string;
  sourceType: number;
  woId: number;
  wo: string;
  woType: number;
  line: string;
  opSeq: number | null;
  opTitle: string;
  report: string;
  reportedAt: string | null;
  product: string;
  unit: string;
  batch: string;
  qty: number;
  ncType: number;
  wasteReason: string;
  reworkReason: string;
  decision: number;
  decidedBy: string;
  decidedAt: string | null;
  targetWo: string;
  targetStatus: number | null;
  regradeProduct: string;
  contractor: string;
  contractorDisposition: number | null;
  penalty: number;
  unitCost: number;
  recoveredValue: number;
  cost: number;
  reworkCycle: number | null;
  note: string;
  customer: string;
  customerOwned: boolean;
}

export interface NcOrder {
  woId: number;
  number: string;
  woType: number;
  status: number;
  qty: number;
  batch: string;
  product: string;
  unit: string;
  sourceWoId: number | null;
  sourceWo: string;
  sourceBatch: string;
  sourceStatus: number | null;
  note: string;
  recoveredCode: string;
  minPurity: number | null;
  maxCycles: number | null;
  requiresQc: boolean | null;
  maxMix: number | null;
}

export interface NcOperation {
  woId: number;
  seq: number;
  title: string;
  kept: boolean;
  status: number | null;
  sourceMaterials: number;
  keptMaterials: number;
}

export interface NcReport {
  woId: number;
  seq: number;
  number: string;
  start: string;
  end: string;
  reprocess: boolean;
  reworkQty: number;
  reworkOk: number;
  reworkWaste: number;
  completed: number;
  wasted: number;
  by: string;
  note: string;
}

export interface ChainRow {
  batch: string;
  product: string;
  cycle: number;
  disposition: string;
  qty: number;
  decision: number;
  sourceWo: string;
  targetWo: string;
  decidedAt: string | null;
  maxCycles: number;
  limit: number;
  note: string;
}

export interface CopqRow {
  line: string;
  ncType: number;
  reason: string;
  reasonCode: string;
  wo: string;
  date: string | null;
  sourceType: number;
  cases: number;
  cost: number;
  recovered: number;
  penalty: number;
}

export interface RecoveredStock {
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
  qc: number | null;
  block: string;
  maxMix: number | null;
}

export interface Pc09Bundle {
  dispositions: Disposition[];
  orders: NcOrder[];
  operations: NcOperation[];
  reports: NcReport[];
  chains: ChainRow[];
  copq: CopqRow[];
  recovered: RecoveredStock[];
}

/** گروه‌بندی‌های پارتو COPQ */
export const COPQ_GROUPS = [
  { label: 'علت', value: 'reason' },
  { label: 'خط', value: 'line' },
  { label: 'نوع نامنطبق', value: 'type' },
  { label: 'دستور کار', value: 'wo' },
  { label: 'منبع', value: 'source' },
];

export const NC_TYPE_COLOR: Record<number, string> = { 1: 'var(--gng-danger)', 2: 'var(--gng-teal)', 3: 'var(--gng-warning)', 4: 'var(--gng-purple)' };
