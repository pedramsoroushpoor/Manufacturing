/** مدل‌های نمایشی FRM-PC-03 «آزادسازی، شارژ و تغذیه‌ی پای کار». دستور و قلم مواد همان مدل FRM-PC-02 است. */
import { WoMaterial, WorkOrder } from './frm-pc-02.data';

export interface ReleaseCheck {
  workOrderId: number;
  code: string;
  title: string;
  statusCode: number;
  detail: string;
}

export interface KitRow {
  workOrderId: number;
  materialId: number;
  operationSeq: number;
  operationTitle: string;
  productCode: string;
  productTitle: string;
  unit: string;
  transferNo: number;
  kitQuantity: number;
  activeQuantity: number;
  batch: string;
  potency: number | null;
  statusCode: number;
  effectiveDate: string | null;
  scanCode: string;
  description: string;
  source: string;
  expireDate: string | null;
}

export interface ExcessRow {
  workOrderId: number;
  product: string;
  unit: string;
  quantity: number;
  reason: string;
  statusCode: number;
  requestDate: string | null;
  approver: string;
  description: string;
  plannedKit: number;
  maxPercent: number | null;
}

export interface ReturnRow {
  workOrderId: number;
  product: string;
  unit: string;
  quantity: number;
  reason: string;
  batch: string;
  document: string;
  date: string | null;
  withinTolerance: boolean;
}

export interface LineSideRow {
  workOrderId: number;
  workOrderNumber: string;
  productCode: string;
  productTitle: string;
  group: string;
  unit: string;
  delivered: number;
  consumed: number;
  returned: number;
  onLine: number;
  remainingNeed: number;
  reorderPoint: number | null;
  minStock: number | null;
  maxStock: number | null;
  feedingPolicyCode: number | null;
}

export interface Pc03Bundle {
  orders: WorkOrder[];
  checks: ReleaseCheck[];
  kits: KitRow[];
  excess: ExcessRow[];
  returns: ReturnRow[];
  lineSide: LineSideRow[];
  materials: WoMaterial[];
}

/** ترتیب ستون‌های ماتریس آمادگی */
export const CHECK_CODES = ['MAT', 'CAP', 'TOOL', 'SKILL', 'QC', 'EQP'];
export const CHECK_TITLE: Record<string, string> = { MAT: 'مواد', CAP: 'ظرفیت', TOOL: 'ابزار', SKILL: 'مهارت', QC: 'مجوز کیفی', EQP: 'تجهیز' };
export const CHECK_ICON: Record<string, string> = { MAT: 'pi pi-box', CAP: 'pi pi-gauge', TOOL: 'pi pi-wrench', SKILL: 'pi pi-users', QC: 'pi pi-verified', EQP: 'pi pi-cog' };
/** وضعیت پیش‌شرط: 1 برقرار، 2 هشدار، 3 مانع */
export const CHECK_STATUS: Record<number, string> = { 1: 'برقرار', 2: 'هشدار', 3: 'مانع' };

export const KIT_STATUS: Record<number, string> = { 1: 'برنامه‌ی انتقال', 2: 'تحویل پای کار', 3: 'مصرف‌شده' };
export const EXCESS_STATUS: Record<number, string> = { 1: 'منتظر تأیید', 2: 'تأییدشده', 3: 'ردشده' };
/** سیاست تغذیه (ME-06) */
export const FEEDING_POLICY: Record<number, string> = { 1: 'انتقال به انبار پای کار', 2: 'تحویل مستقیم به خط', 3: 'کششی (کانبان)', 4: 'تأمین پیوسته', 5: 'تأمین از پیمانکار' };
