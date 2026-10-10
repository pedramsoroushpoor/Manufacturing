/** مدل‌های نمایشی FRM-PC-08 «بازیابی مواد در اجرا» */

export interface RecoveryReceipt {
  id: number;
  number: string;
  date: string;
  woId: number;
  wo: string;
  woType: number;
  opSeq: number;
  opTitle: string;
  report: string;
  recovered: string;
  unit: string;
  source: string;
  sourceInput: number;
  qty: number;
  actual: number;
  standard: number;
  standardSource: string;
  threshold: number;
  batch: string;
  cycle: number;
  purity: number | null;
  minPurity: number | null;
  maxCycles: number | null;
  qc: number | null;
  inventory: string;
  docPattern: string;
  doc: string;
  note: string;
}

export interface BalanceRow {
  id: number;
  type: number;
  woId: number;
  wo: string;
  opSeq: number;
  opTitle: string;
  report: string;
  product: string;
  unit: string;
  from: string;
  to: string;
  input: number;
  output: number;
  loss: number;
  inProcess: number;
  gap: number;
  gapPct: number;
  tolerance: number;
  source: number;
  measuredBy: string;
  note: string;
  posted: number | null;
}

export interface RecoveryStandard {
  code: string;
  recovered: string;
  source: string;
  grade: string;
  standard: number;
  loss: number;
  minPurity: number;
  maxCycles: number;
  equivalence: number;
  requiresQc: boolean;
  routingRate: number | null;
  routingLoss: number | null;
  routingOp: string;
  inventory: string;
}

export interface Pc08Bundle {
  receipts: RecoveryReceipt[];
  balances: BalanceRow[];
  standards: RecoveryStandard[];
}

/** کد منبع اندازه‌گیری موازنه (mes_frm_pc08_setup) */
export const BALANCE_SOURCE: Record<number, string> = { 1: 'دستی', 2: 'توتالایزر توزین‌گر', 3: 'ترازوی مخزن' };

/** قوس نیم‌دایره‌ی گیج: درصد ۰ (چپ) تا ۱۰۰ (راست) روی دایره‌ای به مرکز (cx, cy) */
export function gaugeArc(cx: number, cy: number, r: number, fromPct: number, toPct: number): string {
  const pt = (p: number) => {
    const a = Math.PI * (1 - Math.min(Math.max(p, 0), 100) / 100);
    return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy - r * Math.sin(a)).toFixed(2)}`;
  };
  const large = toPct - fromPct > 50 ? 1 : 0;
  return `M ${pt(fromPct)} A ${r} ${r} 0 ${large} 1 ${pt(toPct)}`;
}

/** نقطه‌ی روی قوس برای عقربه */
export function gaugePoint(cx: number, cy: number, r: number, pct: number): { x: number; y: number } {
  const a = Math.PI * (1 - Math.min(Math.max(pct, 0), 100) / 100);
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
}
