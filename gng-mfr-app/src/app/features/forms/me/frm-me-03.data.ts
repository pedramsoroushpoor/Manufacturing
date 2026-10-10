/** مدل‌های نمایشی FRM-ME-03 «کارکرد استاندارد و زمان عملیات». */
import { RoutingRow } from './me-routing';

export interface TimingRow {
  routingId: number;
  routingOperationId: number;
  sequence: number;
  operation: string;
  natureCode: number;
  outsourced: boolean;
  /** سهم‌بری شاخه‌ی موازی از ME-02؛ خالی = ۱۰۰٪ */
  share: number | null;
  hasTiming: boolean;
  batch: number | null;
  setup: number;
  equipmentRun: number;
  laborRun: number;
  outsourceRun: number;
  teardown: number;
  wait: number;
  waitOccupiesResource: boolean;
  waitNeedsLabor: boolean;
  move: number;
  queue: number;
  transferBatch: number | null;
  splitRuleCode: number;
  maxRun: number | null;
  description: string;
}

export interface CapacityRow {
  routingId: number;
  routingOperationId: number;
  sequence: number;
  operation: string;
  capacityTypeId: number;
  capacity: string;
  unit: string;
  capacityActive: boolean;
  isCostDriver: boolean;
  basisCode: number;
  basis: string;
  fixed: number | null;
  variable: number | null;
  per: number | null;
  steps: string;
  formula: string;
  description: string;
}

export interface ChangeoverCell {
  routingId: number;
  routingOperationId: number;
  sequence: number;
  equipmentId: number;
  equipment: string;
  fromClassId: number | null;
  toClassId: number | null;
  minutes: number | null;
}

export interface ClassRow {
  id: number;
  code: string;
  title: string;
}

export interface Me03Bundle {
  routings: RoutingRow[];
  timings: TimingRow[];
  capacities: CapacityRow[];
  changeovers: ChangeoverCell[];
  classes: ClassRow[];
  productClasses: { routingId: number; classId: number | null }[];
}

export interface Issue {
  severity: 'danger' | 'warning';
  text: string;
}

/** محاسبه‌ی هر ردیف زمان برای مقدار سفارش */
export interface TimingCalc {
  row: TimingRow;
  runs: number;
  setupTotal: number;
  runTotal: number;
  teardownTotal: number;
  waitTotal: number;
  moveQueue: number;
  total: number;
}

export interface CapacityCalc {
  row: CapacityRow;
  required: number | null;
  error: string;
}

export interface EquipmentMatrix {
  routingOperationId: number;
  sequence: number;
  equipment: string;
  cells: Map<string, number>;
  empty: boolean;
}
