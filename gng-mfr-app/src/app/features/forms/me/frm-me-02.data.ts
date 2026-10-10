/** مدل‌های نمایشی FRM-ME-02 «روش ساخت». */
import { RoutingRow } from './me-routing';

export interface AssignmentRow {
  routingId: number;
  structure: string;
  product: string;
  productId: number;
  quantity: number | null;
  unit: string;
}

export interface RoutingOpRow {
  id: number;
  routingId: number;
  sequence: number;
  operationId: number;
  code: string;
  title: string;
  natureCode: number;
  nature: string;
  resource: string;
  /** ۱ تعیین‌شده در روش، ۲ ارث از کتابخانه، ۰ بدون منبع */
  resourceSource: 0 | 1 | 2;
  share: number | null;
  yieldPercent: number | null;
  outsourced: boolean;
  description: string;
}

export interface LinkRow {
  routingId: number;
  fromId: number;
  toId: number;
  share: number | null;
  overlapType: number;
  overlapQuantity: number | null;
  overlapMinutes: number | null;
  description: string;
}

export interface AlternativeRow {
  routingOperationId: number;
  routingId: number;
  sequence: number;
  main: string;
  alternative: string;
  alternativeNature: string;
  resource: string;
  rule: string;
  fromQuantity: number | null;
  toQuantity: number | null;
  priority: number | null;
  description: string;
}

export interface OutputRow {
  routingId: number;
  routingOperationId: number;
  product: string;
  unit: string;
  typeCode: number;
  type: string;
  isMain: boolean;
  quantity: number;
}

export interface Me02Bundle {
  routings: RoutingRow[];
  assignments: AssignmentRow[];
  operations: RoutingOpRow[];
  links: LinkRow[];
  alternatives: AlternativeRow[];
  outputs: OutputRow[];
}

export interface GraphNode {
  op: RoutingOpRow;
  x: number;
  y: number;
  invalid: boolean;
}

export interface GraphEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  back: boolean;
}

export interface Issue {
  severity: 'danger' | 'warning';
  text: string;
}

export interface DiffRow {
  sequence: number;
  kind: 'added' | 'removed' | 'changed';
  left: string;
  right: string;
  fields: string;
}
