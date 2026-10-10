/** مدل‌های نمایشی FRM-PC-01 «درخواست تولید» (روی mes.ProductionRequest* و دستورهای PC-02). */

export interface RequestRow {
  id: number;
  number: string;
  requestDate: string | null;
  originCode: number;
  priorityCode: number;
  productId: number;
  productCode: string;
  productTitle: string;
  unit: string;
  productGroup: string;
  quantity: number;
  needDate: string | null;
  requesterUnit: string;
  requester: string;
  generalRequisition: string;
  salesOrder: string;
  customer: string;
  statusCode: number;
  description: string;
  orderedQuantity: number;
}

export interface ApprovalRow {
  requestId: number;
  sequence: number;
  role: string;
  approver: string;
  decisionCode: number | null;
  decisionDate: string | null;
  comment: string;
}

export interface ApprovalRule {
  sequence: number;
  originCode: number | null;
  minQuantity: number | null;
  productGroup: string | null;
  requesterUnit: string | null;
  role: string;
  description: string;
}

/** دستور کار مرتبط (از /api/pc02/bundle) — فقط آنچه پیگیری درخواست لازم دارد */
export interface LinkedOrder {
  id: number;
  number: string;
  name: string;
  typeCode: number;
  statusCode: number;
  quantity: number;
  unit: string;
  line: string;
  plannedComplete: string | null;
  actualComplete: string | null;
  due: string | null;
  produced: number;
  currentOperation: string;
  operationCount: number;
  operationsDone: number;
  requestNumbers: string[];
  ops: { seq: number; title: string; statusCode: number; pct: number }[];
}

export interface FeasSummary {
  versionId: number | null;
  versionCode: string;
  versionTitle: string;
  structureCode: string;
  leadTimeHours: number | null;
  batchCount: number | null;
  needDate: string | null;
}

export interface FeasMaterial {
  sequence: number;
  productCode: string;
  productTitle: string;
  unit: string;
  required: number;
  available: number;
  inTransit: number;
  lastArrival: string | null;
}

export interface Feasibility {
  summary: FeasSummary | null;
  materials: FeasMaterial[];
}

/** ستون‌های تابلوی وضعیت؛ «ردشده» فقط اگر ردیفی داشته باشد نشان داده می‌شود */
export const BOARD_COLUMNS = [1, 2, 3, 4, 5];

export const DECISION: Record<number, string> = { 1: 'تأیید', 2: 'رد' };

export const ORIGIN_ICON: Record<number, string> = {
  1: 'pi pi-shopping-cart',
  2: 'pi pi-warehouse',
  3: 'pi pi-calculator',
  4: 'pi pi-building',
  5: 'pi pi-briefcase',
};

/** یک روز به میلی‌ثانیه */
export const DAY_MS = 86400000;
