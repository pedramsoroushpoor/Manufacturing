/** مدل‌های نمایشی FRM-ME-05 «عملیات بازیابی مواد». */

export interface RecoveryRow {
  id: number;
  routing: string;
  routingStatusCode: number;
  sequence: number;
  operation: string;
  recoveredCode: string;
  product: string;
  unit: string;
  source: string;
  standardPercent: number | null;
  standardLoss: number | null;
  requiresQc: boolean;
  minPurity: number | null;
  method: string;
  percent: number;
  loss: number | null;
  receiptInventory: string;
  documentPattern: string;
  returnModeCode: number;
  returnMode: string;
  locationCode: number;
  location: string;
  contractor: string;
  description: string;
  sourceInput: number | null;
  output: number | null;
  /** ورودی مبدأ × نرخ این عملیات */
  expectedOutput: number | null;
}

export interface RecoveredCoverageRow {
  code: string;
  product: string;
  source: string;
  mode: string;
  standardPercent: number | null;
  isActive: boolean;
  operationCount: number;
}

export interface Me05Bundle {
  recoveries: RecoveryRow[];
  coverage: RecoveredCoverageRow[];
}

export interface Issue {
  severity: 'danger' | 'warning';
  text: string;
}
