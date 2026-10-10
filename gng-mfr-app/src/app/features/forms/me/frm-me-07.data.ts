/** مدل‌های نمایشی FRM-ME-07 «برون‌سپاری و کارمزدی». */

export interface OutsourcedOpRow {
  id: number;
  routing: string;
  routingStatusCode: number;
  sequence: number;
  operation: string;
  opsBefore: number;
  opsAfter: number;
  contractorCount: number;
}

export interface SubcontractRow {
  routingOperationId: number;
  contractor: string;
  contractorActive: boolean;
  qualificationCode: number;
  qualification: string;
  contractTo: string;
  capabilityOperation: string;
  priority: number;
  rule: string;
  fee: number | null;
  feeUnit: string;
  currency: string;
  leadDays: number | null;
  allowedWaste: number | null;
  supplyCode: number;
  supply: string;
  serviceItem: string;
  description: string;
  hasCapability: boolean;
  registeredFee: number | null;
}

export interface SubcontractItemRow {
  routingOperationId: number;
  directionCode: number;
  product: string;
  unit: string;
  quantity: number | null;
  supplyCode: number;
  description: string;
}

export interface TollRow {
  routingId: number;
  routing: string;
  customer: string;
  product: string;
  group: string;
  quantity: number | null;
  unit: string;
  ownershipCode: number | null;
  surplusCode: number | null;
  wasteCode: number | null;
  description: string;
}

export interface Me07Bundle {
  operations: OutsourcedOpRow[];
  subcontracts: SubcontractRow[];
  items: SubcontractItemRow[];
  toll: TollRow[];
}

export interface Issue {
  severity: 'danger' | 'warning';
  text: string;
}
