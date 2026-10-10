/** مدل‌های نمایشی FRM-PC-02 «دستور کار» (روی mes.WorkOrder*). */

export interface WorkOrder {
  id: number;
  number: string;
  name: string;
  typeCode: number;
  statusCode: number;
  priorityCode: number;
  basisCode: number;
  productId: number;
  productCode: string;
  productTitle: string;
  unit: string;
  quantity: number;
  lineId: number | null;
  line: string;
  versionId: number | null;
  versionCode: string;
  versionNote: string;
  versionOverridden: boolean;
  overrideReason: string;
  routingCode: string;
  structureCode: string;
  batchNumber: string;
  plannedRelease: string | null;
  actualRelease: string | null;
  plannedComplete: string | null;
  actualComplete: string | null;
  closeDate: string | null;
  dueDate: string | null;
  shiftDate: string | null;
  shiftTitle: string;
  shiftId: number | null;
  refId: number | null;
  refNumber: string;
  customer: string;
  configuration: string;
  referenceObject: string;
  description: string;
  lastOpCompleted: number;
  wastedTotal: number;
  operationCount: number;
  operationsDone: number;
  currentOperation: string;
  requests: string;
}

export interface WoOperation {
  workOrderId: number;
  id: number;
  sequence: number;
  code: string;
  title: string;
  natureCode: number;
  statusCode: number;
  outsourced: boolean;
  resource: string;
  toComplete: number;
  received: number;
  inProcess: number;
  completed: number;
  wasted: number;
  rework: number;
  transferred: number;
  yieldPct: number | null;
  actualYieldPct: number | null;
  start: string | null;
  end: string | null;
  planStart: string | null;
  planEnd: string | null;
  description: string;
  stdMinutes: number;
}

export interface WoMaterial {
  workOrderId: number;
  id: number;
  operationId: number;
  operationSeq: number;
  productId: number;
  productCode: string;
  productTitle: string;
  unit: string;
  group: string;
  standard: number;
  plannedKit: number;
  actualKit: number | null;
  consumed: number | null;
  returned: number | null;
  excess: number | null;
  shortage: number | null;
  statusCode: number;
  batch: string;
  potency: number | null;
  customer: boolean;
  recovered: boolean;
  quantumSatis: boolean;
  substitutedTitle: string;
  description: string;
  stockAvailable: number;
  stockReserved: number;
  stockInTransit: number;
  nextArrival: string | null;
}

export interface WoProduct {
  workOrderId: number;
  productCode: string;
  productTitle: string;
  unit: string;
  typeCode: number;
  quantity: number;
  yieldPct: number | null;
  actualYieldPct: number | null;
  description: string;
}

export interface WoChange {
  workOrderId: number;
  date: string | null;
  field: string;
  oldValue: string;
  newValue: string;
  statusCode: number;
  requestedBy: string;
  approvedBy: string;
  reason: string;
  recalculation: string;
}

export interface WoCancellation {
  workOrderId: number;
  date: string | null;
  reason: string;
  materialDispositionCode: number | null;
  workDispositionCode: number | null;
  inventoryDocument: string;
  permit: string;
  description: string;
}

export interface Pc02Bundle {
  orders: WorkOrder[];
  operations: WoOperation[];
  materials: WoMaterial[];
  products: WoProduct[];
  changes: WoChange[];
  cancellations: WoCancellation[];
}

/** مبنای صدور دستور (F-PC-008) */
export const WO_BASIS: Record<number, string> = { 1: 'درخواست تولید', 2: 'برنامه‌ی تولید', 3: 'سفارش مشتری', 4: 'دستور بالادستی', 5: 'بدون مبنا (با مجوز)' };

/** ماهیت عملیات */
export const OP_NATURE: Record<number, string> = { 1: 'تولیدی', 2: 'بازرسی', 3: 'بسته‌بندی', 4: 'انتظار', 5: 'برون‌سپاری', 6: 'انتقال' };

export const CHANGE_STATUS: Record<number, string> = { 1: 'منتظر تأیید', 2: 'تأییدشده', 3: 'ردشده' };
export const MATERIAL_DISPOSITION: Record<number, string> = { 1: 'برگشت به انبار', 2: 'انتقال به دستور دیگر', 3: 'اسقاط' };
export const WORK_DISPOSITION: Record<number, string> = { 1: 'انتقال نیمه‌ساخته به انبار', 2: 'انتقال به دستور دیگر', 3: 'اسقاط' };

/** رنگ نوع دستور برای چیپ‌ها */
export const WO_TYPE_ICON: Record<number, string> = {
  1: 'pi pi-cog', 2: 'pi pi-sync', 3: 'pi pi-replay', 4: 'pi pi-refresh', 5: 'pi pi-external-link', 6: 'pi pi-briefcase', 7: 'pi pi-flask', 8: 'pi pi-wrench', 9: 'pi pi-folder',
};

export const HOUR_MS = 3600000;
