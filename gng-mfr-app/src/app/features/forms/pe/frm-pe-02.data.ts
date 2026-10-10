/**
 * شکل ردیف‌هایی که قالب FRM-PE-02 مصرف می‌کند. داده از اسکیمای mes می‌آید
 * (frm-pe-02.service.ts)؛ این فرم داده‌ی Mock ندارد.
 */
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'secondary';

/** کدهای موقت تا رسیدن کدلیست اصلی (به سرآغاز mes_frm_pe02_setup.sql نگاه کنید). */
export const TYPE_LABEL: Record<number, string> = { 1: 'تولیدی', 2: 'آزمایشی / R&D', 3: 'الگو', 4: 'نمونه‌سازی', 5: 'مهندسی' };
export const TYPE_ICON: Record<number, string> = { 1: 'pi pi-cog', 2: 'pi pi-flask', 3: 'pi pi-clone', 4: 'pi pi-box', 5: 'pi pi-pencil' };
export const STATUS: Record<number, { label: string; tone: Tone }> = {
  1: { label: 'پیش‌نویس', tone: 'secondary' },
  2: { label: 'در گردش تأیید', tone: 'info' },
  3: { label: 'تأییدشده', tone: 'success' },
  4: { label: 'منسوخ', tone: 'secondary' },
};
export const QTYPE_LABEL: Record<number, string> = { 1: 'ثابت در هر بچ', 2: 'متناسب با اندازه‌ی مرجع', 3: 'فرمولی', 4: 'درصدی' };
export const EFFECTIVITY_LABEL: Record<number, string> = { 1: 'تاریخ‌محور', 2: 'بچ‌محور', 3: 'سفارش‌محور' };
export const REVISION_STATUS: Record<number, { label: string; tone: Tone }> = {
  1: { label: 'پیش‌نویس', tone: 'secondary' },
  2: { label: 'در گردش تأیید', tone: 'info' },
  3: { label: 'فعال', tone: 'success' },
  4: { label: 'منسوخ', tone: 'secondary' },
};
export const DOC_TYPE_LABEL: Record<number, string> = { 1: 'پروانه‌ی ساخت', 2: 'مشخصات', 3: 'تصویر', 4: 'نقشه', 5: 'سایر' };
export const APPROVAL: Record<number, { label: string; tone: Tone }> = {
  1: { label: 'در انتظار تأیید', tone: 'warning' },
  2: { label: 'تأییدشده', tone: 'success' },
  3: { label: 'ردشده', tone: 'danger' },
};
export const SOURCE: Record<string, { label: string; tone: Tone }> = {
  own: { label: 'ردیف خودش', tone: 'secondary' },
  inherited: { label: 'از الگو', tone: 'info' },
  override: { label: 'بازنویسی الگو', tone: 'warning' },
  removed: { label: 'حذف از الگو', tone: 'danger' },
};

/** یک ساختار در فهرست (پنل کناری و برگه‌ی «اطلاعات کلی»). */
export interface StructureRow {
  id: number;
  code: string;
  title: string;
  productId: number | null;
  product: string;
  productUnit: string;
  productHasRole: boolean;
  typeCode: number;
  isTemplate: boolean;
  statusCode: number;
  isDefault: boolean;
  group: string;
  profile: string;
  license: string;
  baseQuantity: number | null;
  batchRange: string;
  allowOver100: boolean;
  validity: string;
  revisionId: number;
  revisionCode: string;
  template: string;
  itemCount: number;
  childCount: number;
  scope: string;
  byOrder: boolean;
  pendingTypeChanges: number;
  description: string;
}

/** یک ردیف مصرفی مؤثر. */
export interface ItemRow {
  key: string;
  source: string;
  sourceCode: string;
  seq: number;
  productId: number;
  product: string;
  stockUnit: string;
  isPhantom: boolean;
  role: string;
  quantityType: string;
  quantityTypeCode: number;
  defined: string;
  /** درصد در ترکیب (برای ردیف درصدی و q.s.)؛ null برای بقیه. */
  percent: number | null;
  atBase: string;
  isQs: boolean;
  isActive: boolean;
  assay: string;
  waste: string;
  range: string;
  unitConversion: string;
  description: string;
}

/** کنترل جمع درصد (F-PE-020). */
export interface PercentCheck {
  applies: boolean;
  sum: number;
  qsShare: number;
  total: number;
  ok: boolean;
  tone: Tone;
  text: string;
}

export interface RevisionRow {
  revisionId: number;
  code: string;
  status: string;
  statusTone: Tone;
  effectivity: string;
  range: string;
  approver: string;
  eco: string;
  description: string;
  isCurrent: boolean;
  ownItemCount: number;
}

export interface ScopeRow {
  level: string;
  title: string;
  validity: string;
  description: string;
}

export interface TypeChangeRow {
  from: string;
  to: string;
  requested: string;
  status: string;
  statusTone: Tone;
  approvers: string;
  description: string;
}

export interface TransitionRow {
  from: string;
  to: string;
  approval: string;
  fromCurrent: boolean;
}

export interface AttachmentRow {
  type: string;
  title: string;
  number: string;
  fileName: string;
  validity: string;
  state: string;
  stateTone: Tone;
  linked: boolean;
}

export interface DiffRow {
  product: string;
  status: 'added' | 'removed' | 'changed' | 'same';
  fields: string;
  left: string;
  right: string;
}

export const DIFF_STATUS: Record<DiffRow['status'], { label: string; tone: Tone }> = {
  added: { label: 'افزوده', tone: 'success' },
  removed: { label: 'حذف‌شده', tone: 'danger' },
  changed: { label: 'تغییریافته', tone: 'warning' },
  same: { label: 'بدون تغییر', tone: 'secondary' },
};

/** گزینه‌ی انتخاب طرفین مقایسه: «ساختار|نسخه». */
export interface DiffOption {
  label: string;
  value: string;
}
