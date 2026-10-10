/** مدل‌های نمایشی FRM-ME-04 «اقلام و خروجی در سطح عملیات». */
import { RoutingRow } from './me-routing';

export interface MaterialRow {
  routingId: number;
  structure: string;
  itemId: number;
  itemSequence: number;
  product: string;
  unit: string;
  structureQuantity: number | null;
  isActiveIngredient: boolean;
  rowWaste: number | null;
  rowWasteWins: boolean;
  routingOperationId: number | null;
  operationSequence: number | null;
  operation: string;
  pointCode: number | null;
  point: string;
  allocation: number | null;
  backflushed: boolean;
  allocatedQuantity: number | null;
  description: string;
}

export interface StageRow {
  routingId: number;
  routingOperationId: number;
  sequence: number;
  operation: string;
  yieldPercent: number | null;
  share: number | null;
  storageCode: number | null;
  storage: string;
  lineSide: string;
  processWaste: number | null;
  wastePriorityCode: number | null;
}

export interface OutputRow {
  routingId: number;
  routingOperationId: number;
  sequence: number;
  product: string;
  unit: string;
  typeCode: number;
  type: string;
  isMain: boolean;
  stored: boolean;
  quantity: number;
  description: string;
}

export interface CoverageRow {
  routingId: number;
  structure: string;
  product: string;
  typeCode: number;
  type: string;
  quantity: number;
  unit: string;
  operations: string;
}

export interface AttributeRow {
  routingId: number;
  routingOperationId: number;
  sequence: number;
  operation: string;
  attributeId: number;
  attribute: string;
  unit: string;
  actionCode: number;
  action: string;
  qcGate: boolean;
  description: string;
}

export interface LinkRow {
  routingId: number;
  fromId: number;
  toId: number;
}

export interface Me04Bundle {
  routings: RoutingRow[];
  links: LinkRow[];
  stages: StageRow[];
  materials: MaterialRow[];
  outputs: OutputRow[];
  coverage: CoverageRow[];
  attributes: AttributeRow[];
}

/** یک ردیف ساختار با جمع تخصیص‌هایش */
export interface ItemCoverage {
  structure: string;
  itemSequence: number;
  product: string;
  allocations: MaterialRow[];
  total: number;
}

export interface YieldRow {
  stage: StageRow;
  cumYield: number;
  requiredInput: number;
  onMainPath: boolean;
}

export interface Issue {
  severity: 'danger' | 'warning';
  text: string;
}
