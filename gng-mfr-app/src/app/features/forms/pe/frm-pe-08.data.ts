/**
 * شکل ردیف‌هایی که قالب FRM-PE-08 (کنسول تحلیلی ساختار) مصرف می‌کند. داده از
 * اسکیمای mes می‌آید (frm-pe-08.service.ts)؛ این فرم داده‌ی Mock ندارد.
 */
export interface Option {
  label: string;
  value: number;
}

/** یک گره‌ی درخت بسط. */
export interface ExplodeNode {
  key: string;
  parentKey: string;
  level: number;
  productId: number;
  product: string;
  unit: string;
  required: number | null;
  formula: boolean;
  isPhantom: boolean;
  isLeaf: boolean;
  isCycle: boolean;
  childStructure: string;
}

/** نیاز ناخالص هر کالای برگ (جمع همه‌ی مسیرها). */
export interface RequirementRow {
  product: string;
  unit: string;
  required: number;
  paths: number;
}

export interface WhereUsedRow {
  level: number;
  searched: string;
  structure: string;
  type: string;
  isDefault: boolean;
  mainProduct: string;
  revisions: string;
  inCurrent: boolean;
  viaTemplate: boolean;
}
