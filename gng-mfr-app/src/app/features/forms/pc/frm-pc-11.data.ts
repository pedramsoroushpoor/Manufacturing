/** FRM-PC-11 — مدل نمای پورتال پیمانکار و مشتری کارمزدی (روی /api/pc11/bundle و /api/pc11/view). */
import { ProgressRow, ReconRow, Shipment, StatementRow, SubOrder, TollContract } from './frm-pc-10.data';

export interface PortalAccount {
  id: number;
  userName: string;
  displayName: string;
  partyTypeCode: number;
  contractorId: number | null;
  contractor: string;
  contractId: number | null;
  customer: string;
  contractNumber: string;
  canReport: boolean;
  canBalances: boolean;
  canFees: boolean;
  lastLogin: string | null;
  active: boolean;
  description: string;
}

/** عملیات دستور کارمزدی که مشتری می‌بیند */
export interface TollOperation {
  workOrderId: number;
  workOrder: string;
  batch: string;
  quantity: number;
  woStatusCode: number;
  dueDate: string | null;
  seq: number;
  title: string;
  statusCode: number;
  toComplete: number;
  completed: number;
  wasted: number;
  start: string | null;
  end: string | null;
  description: string;
}

/** آنچه سرور برای یک حساب برمی‌گرداند (سرور طرف را از حساب پیدا می‌کند) */
export interface PortalView {
  accountId: number;
  partyTypeCode: number;
  canViewBalances: boolean;
  canViewFees: boolean;
  isActive: boolean;
  orders: SubOrder[];
  progress: ProgressRow[];
  shipments: Shipment[];
  subBalances: ReconRow[];
  contracts: TollContract[];
  tollBalances: StatementRow[];
  operations: TollOperation[];
  /** تعداد کل ردیف‌های برگشتی — برای هشدار حساب غیرفعال */
  rowCount: number;
}

/** یک قلم از فهرست «چه چیزی دیده می‌شود / پنهان است» */
export interface IsolationItem {
  label: string;
  state: 'shown' | 'masked' | 'hidden';
  note: string;
}

export const PARTY_TYPE: Record<number, string> = { 1: 'پیمانکار', 2: 'مشتری کارمزدی' };

/** زبان طرف بیرونی برای جهت اسناد */
export const PORTAL_DIRECTION: Record<number, string> = {
  1: 'دریافتی شما از گلرنگ',
  2: 'ارسالی شما به گلرنگ',
  3: 'ارسالی شما به گلرنگ (مواد)',
  4: 'دریافتی شما از گلرنگ (محصول)',
};

export const PORTAL_TABS = ['سفارش‌های من', 'ثبت پیشرفت', 'ارسال و دریافت', 'مانده‌ی مواد امانی'];

/** حساب فعالی که این مدت وارد نشده «کهنه» است (روز) */
export const STALE_LOGIN_DAYS = 30;
