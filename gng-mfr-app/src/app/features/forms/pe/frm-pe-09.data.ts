/** مدل‌های نمایشی FRM-PE-09 «مدیریت تغییر مهندسی (ECO)». */

export interface Option {
  label: string;
  value: number;
}

export interface EcoRow {
  id: number;
  number: string;
  title: string;
  origin: string;
  priority: string;
  statusCode: number;
  status: string;
  requestedBy: string;
  requestDate: string;
  effectiveDate: string;
  inventoryPolicyCode: number | null;
  inventoryPolicy: string;
  inventoryCondition: string;
  reason: string;
  description: string;
  itemCount: number;
  approverCount: number;
  signedCount: number;
  linkedRevisions: string;
}

export interface ScopeRow {
  entityType: string;
  changeType: string;
  entity: string;
  before: string;
  after: string;
  description: string;
}

export interface ApprovalRow {
  sequence: number;
  role: string;
  approver: string;
  decisionCode: number | null;
  signedOn: string;
  method: string;
  comment: string;
}

export interface NotificationRow {
  unit: string;
  statusCode: number;
  sentOn: string;
  message: string;
}

export interface ImpactRow {
  kind: 'direct' | 'upstream';
  level: number;
  product: string;
  structure: string;
  inCurrent: boolean | null;
}

export interface Pe09Bundle {
  ecoId: number | null;
  ecos: EcoRow[];
  items: ScopeRow[];
  approvals: ApprovalRow[];
  notifications: NotificationRow[];
  impact: ImpactRow[];
}

/** مراحل چرخه‌ی ECO؛ کد وضعیت ۱..۵ به ترتیب، ۶ = ردشده. */
export const ECO_STEPS = ['پیش‌نویس', 'تحلیل اثر', 'در انتظار تأیید', 'تأییدشده', 'اجراشده'];
