/** FRM-PC-10 — مدل نمای اجرای برون‌سپاری و کارمزدی (روی /api/pc10/bundle). */

export interface SubOrder {
  workOrderId: number;
  workOrder: string;
  batch: string;
  product: string;
  operationId: number;
  opSeq: number;
  opTitle: string;
  opStatusCode: number;
  toComplete: number;
  contractorId: number;
  contractorCode: string;
  contractor: string;
  sendNumber: string;
  sentAt: string | null;
  dueDate: string | null;
  serviceRequest: string;
  transferDoc: string;
  waybill: string;
  feePerUnit: number | null;
  feeUnitTitle: string;
  leadDays: number | null;
  rateTitle: string;
  stageCode: number | null;
  progressAt: string | null;
  progressCompleted: number;
  progressWasted: number;
  expectedReady: string | null;
  receivedGood: number;
  accepted: number;
  receivedDefective: number;
  declaredWaste: number;
  lastReceipt: string | null;
  feePayable: number | null;
  delayDays: number;
  isOverdue: boolean;
  nextSeq: number | null;
  nextOpTitle: string;
  nextStatusCode: number | null;
  nextReceived: number;
}

export interface ProgressRow {
  id: number;
  workOrderId: number;
  workOrder: string;
  opSeq: number;
  contractor: string;
  reportedAt: string;
  stageCode: number;
  completed: number;
  wasted: number;
  expectedReady: string | null;
  reportedBy: string;
  sourceCode: number;
  note: string;
}

export interface ShipmentItem {
  id: number;
  shipmentId: number;
  productId: number;
  product: string;
  unit: string;
  batch: string;
  quantity: number;
  roleCode: number;
  accepted: number | null;
  rejected: number | null;
  customerOwned: boolean;
  owner: string;
  description: string;
}

export interface Shipment {
  id: number;
  number: string;
  directionCode: number;
  contractorId: number | null;
  contractor: string;
  tollingContractId: number | null;
  customer: string;
  workOrderId: number | null;
  workOrder: string;
  opSeq: number | null;
  date: string | null;
  expectedReturn: string | null;
  transferDoc: string;
  waybill: string;
  vehicle: string;
  driver: string;
  serviceRequest: string;
  statusCode: number;
  contractorInventory: string;
  referenceInventory: string;
  description: string;
  items: ShipmentItem[];
}

export interface ReconRow {
  workOrderId: number;
  workOrder: string;
  contractor: string;
  productId: number;
  product: string;
  unit: string;
  batch: string;
  sent: number;
  declared: number;
  returned: number;
  remaining: number;
  difference: number;
}

export interface TollContract {
  id: number;
  number: string;
  customer: string;
  product: string;
  feePerUnit: number | null;
  feeUnitTitle: string;
  feeUnitSize: number;
  allowedWastePct: number;
  validFrom: string | null;
  validTo: string | null;
  workOrderId: number | null;
  workOrder: string;
  woStatusCode: number;
  orderQty: number;
  batch: string;
  delivered: number;
  feeEarned: number | null;
  feeProjected: number | null;
  furthestCompleted: number;
  wastedSoFar: number;
  description: string;
}

export interface StatementRow {
  contractId: number;
  customer: string;
  productId: number;
  product: string;
  unit: string;
  batch: string;
  received: number;
  firstReceipt: string | null;
  consumed: number;
  remaining: number;
  difference: number;
}

export interface StockRow {
  owner: string;
  customerOwned: boolean;
  kindCode: number;
  inventory: string;
  productId: number;
  product: string;
  group: string;
  unit: string;
  batch: string;
  onHand: number;
  qcCode: number;
  holder: string;
}

export interface ConsumptionRow {
  workOrder: string;
  woTypeCode: number;
  customer: string;
  customerMaterial: boolean;
  product: string;
  unit: string;
  consumed: number;
}

export interface Pc10Bundle {
  orders: SubOrder[];
  progress: ProgressRow[];
  shipments: Shipment[];
  recon: ReconRow[];
  contracts: TollContract[];
  statement: StatementRow[];
  stock: StockRow[];
  consumption: ConsumptionRow[];
}

/** یک بخش آبشار مغایرت (سهم از ارسالی) */
export interface WaterSeg {
  label: string;
  value: number;
  pct: number;
  cls: string;
}

/** گام ردیاب وضعیت نزد پیمانکار */
export interface StageStep {
  label: string;
  meta: string;
  state: 'done' | 'active' | 'partial' | '';
}

/** بخش‌های تفکیک مالکیت — هرگز با هم جمع نمی‌شوند */
export interface OwnerSection {
  key: 'own' | 'contractor' | 'customer';
  title: string;
  hint: string;
  rows: StockRow[];
  totals: { unit: string; qty: number }[];
}

/** سقف پیش‌فرض تلورانس مغایرت مواد امانی (٪) — تا تعریف در قرارداد پیمانکار */
export const DEFAULT_RECON_TOLERANCE = 2;

/** واحد نرخ کارمزد سفارش برون‌سپاری («هر ۱۰۰۰ قرص»)؛ API برای سفارش اندازه‌ی واحد را برنمی‌گرداند. */
export const SUB_FEE_UNIT_SIZE = 1000;
