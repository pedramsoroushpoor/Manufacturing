export type DiagramNodeVariant = 'start' | 'process' | 'decision' | 'end';
export interface WorkflowNode {
  id: string;
  label: string;
  variant: DiagramNodeVariant;
  col: number;
  row: number;
}
export const WORKFLOW_NODES: WorkflowNode[] = [
  { id: 'start', label: 'شروع — ثبت', variant: 'start', col: 4, row: 1 },
  { id: 'review', label: 'بررسی دفتر فنی', variant: 'process', col: 3, row: 1 },
  { id: 'amount', label: 'مبلغ؟', variant: 'decision', col: 2, row: 1 },
  { id: 'techManager', label: 'تایید مدیر فنی', variant: 'process', col: 1, row: 0 },
  { id: 'qc', label: 'تایید کنترل کیفیت', variant: 'process', col: 1, row: 2 },
  { id: 'end', label: 'پایان — فعال', variant: 'end', col: 0, row: 1 },
];
export const WORKFLOW_EDGES = [
  { from: 'techManager', label: '> ۵۰۰ م' },
  { from: 'qc', label: '≤ ۵۰۰ م' },
];
export const WORKFLOW_ENTITY = 'WF-BOM-APPROVAL';
export const WORKFLOW_BANNER =
  'مسیر گردش بر مبنای داده‌ی فرم شرط‌گذاری شده است. مبلغ بیش از ۵۰۰ میلیون به مدیر فنی و کمتر از آن به کنترل کیفیت می‌رود.';

export interface StatusChip {
  label: string;
  tone: 'secondary' | 'warning' | 'info' | 'success' | 'danger';
}
export const CUSTOM_STATUSES: StatusChip[] = [
  { label: 'پیش‌نویس', tone: 'secondary' },
  { label: 'در بررسی فنی', tone: 'warning' },
  { label: 'در تایید کیفی', tone: 'warning' },
  { label: 'تایید‌شده', tone: 'info' },
  { label: 'فعال', tone: 'success' },
  { label: 'معلق', tone: 'danger' },
  { label: 'منسوخ', tone: 'secondary' },
];
export const STATUS_NOTE = 'دو وضعیت «در بررسی فنی» و «معلق» توسط کاربر افزوده شده‌اند.';

export interface DelegationRow {
  scope: string;
  from: string;
  to: string;
  range: string;
}
export const DELEGATIONS: DelegationRow[] = [
  { scope: 'تایید ECO', from: 'دکتر نوروزی', to: 'م. رضایی', range: '۱۴۰۵/۰۶/۰۱ – ۰۵/۲۸' },
  { scope: 'تایید دستور', from: 'س. مصطفایی', to: 'ا. کریمی', range: '۱۴۰۵/۰۶/۱۰ – ۰۵/۳۰' },
];
export const DELEGATION_NOTE = 'تفویض پس از پایان بازه به‌صورت خودکار باطل می‌شود و در لاگ ممیزی ثبت شده است.';
export const DESIGN_PRINCIPLE_NOTE =
  'اصل طراحی: اقدام غیرمجاز پنهان نمی‌شود؛ غیرفعال و برچسب‌دار می‌ماند تا کاربر بداند قابلیت وجود دارد و مجوزش را ندارد.';

export type AccessLevel = 'view' | 'edit' | 'approve' | 'none';
export interface AccessMatrixRow {
  entity: string;
  roles: AccessLevel[];
}
export const ACCESS_ROLES = ['مهندسی محصول', 'دفتر فنی', 'مهندسی تولید', 'برنامه‌ریز', 'سرپرست خط', 'اپراتور'];
export const ACCESS_MATRIX: AccessMatrixRow[] = [
  { entity: 'ساختار محصول', roles: ['edit', 'edit', 'view', 'view', 'none', 'none'] },
  { entity: 'روش ساخت', roles: ['view', 'edit', 'edit', 'view', 'none', 'none'] },
  { entity: 'نسخه تولید', roles: ['view', 'approve', 'edit', 'view', 'none', 'none'] },
  { entity: 'دستور کار', roles: ['view', 'view', 'view', 'edit', 'edit', 'view'] },
  { entity: 'گزارش تولید', roles: ['none', 'view', 'view', 'view', 'edit', 'edit'] },
  { entity: 'تقویم تولید', roles: ['view', 'view', 'edit', 'view', 'none', 'none'] },
];

export interface FieldAccessRow {
  form: string;
  field: string;
  viewRoles: string;
  editRoles: string;
}
export const FIELD_ACCESS: FieldAccessRow[] = [
  { form: 'FRM-RM-03 نیروی کار', field: 'نرخ ساعتی', viewRoles: 'بهای تمام‌شده، مدیر تولید', editRoles: 'بهای تمام‌شده' },
  { form: 'FRM-PE-02 ساختار محصول', field: 'درصد اقلام', viewRoles: 'مهندسی محصول، کیفیت، دفتر فنی', editRoles: 'مهندسی محصول' },
  { form: 'FRM-RM-08 پیمانکاران', field: 'نرخ کارمزد', viewRoles: 'بهای تمام‌شده، برون‌سپاری', editRoles: 'بهای تمام‌شده' },
];

export const AUDIT_RANGE = 'F-PF-020 تا F-PF-025';
