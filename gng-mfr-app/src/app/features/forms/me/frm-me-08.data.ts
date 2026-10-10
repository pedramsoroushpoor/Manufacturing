/** مدل‌های نمایشی FRM-ME-08 «نسخه‌ی تولید». */

export interface VersionRow {
  id: number;
  code: string;
  title: string;
  productId: number;
  product: string;
  unit: string;
  structure: string;
  structureStatusCode: number;
  routingId: number;
  routing: string;
  routingStatusCode: number;
  routingValidTo: string | null;
  routingMinBatch: number | null;
  routingMaxBatch: number | null;
  routingTypeCode: number;
  orgNode: string;
  lineId: number | null;
  line: string;
  linesInScope: string;
  minBatch: number | null;
  maxBatch: number | null;
  effectivityCode: number;
  effectivity: string;
  validFrom: string;
  validTo: string;
  validFromIso: string | null;
  validToIso: string | null;
  fromBatch: string;
  toBatch: string;
  workOrder: string;
  priority: number;
  statusCode: number;
  status: string;
  productionTypeCode: number;
  orderBasisCode: number;
  allowsStandard: boolean;
  allowsRework: boolean;
  allowsSample: boolean;
  allowsToll: boolean;
  baseCost: number | null;
  baseLeadHours: number | null;
  approver: string;
  description: string;
  routingAssigned: boolean;
  productMatches: boolean;
}

export interface SelectionRow {
  versionId: number;
  code: string;
  title: string;
  priority: number;
  minBatch: number | null;
  maxBatch: number | null;
  rejectReason: string | null;
  rank: number | null;
  selected: boolean;
  eligibleCount: number;
}

export interface Issue {
  severity: 'danger' | 'warning';
  text: string;
}
