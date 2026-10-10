/** مدل‌های نمایشی FRM-ME-09 «تولید پیوسته و کمپین». */

export interface ContinuousRoutingRow {
  id: number;
  routing: string;
  statusCode: number;
  rate: number | null;
  rateBasisCode: number | null;
  rateText: string;
  batch: number;
  line: string;
  unit: string;
  operations: string;
  versions: string;
}

export interface ShiftTemplateRow {
  id: number;
  versionId: number;
  version: string;
  orderBasisCode: number;
  versionStatusCode: number;
  shift: string;
  fromTime: number;
  toTime: number;
  shiftMinutes: number;
  planned: number;
  netRunMinutes: number | null;
  active: boolean;
  description: string;
  capacity: number;
}

export interface HandoverRow {
  routingId: number;
  routing: string;
  routingOperationId: number;
  sequence: number;
  operation: string;
  modeCode: number | null;
  mode: string;
  maxCarryHours: number | null;
  requiresCount: boolean | null;
  description: string;
}

export interface Me09Bundle {
  routings: ContinuousRoutingRow[];
  templates: ShiftTemplateRow[];
  handovers: HandoverRow[];
}

export interface Issue {
  severity: 'danger' | 'warning';
  text: string;
}
