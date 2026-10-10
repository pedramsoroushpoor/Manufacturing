/**
 * شکل ردیف‌هایی که قالب FRM-PE-03 مصرف می‌کند. داده از اسکیمای mes می‌آید
 * (frm-pe-03.service.ts)؛ این فرم داده‌ی Mock ندارد.
 */
export interface GroupRow {
  id: number;
  code: string;
  title: string;
  combinable: boolean;
  active: boolean;
  description: string;
  optionCount: number;
  structureCount: number;
  duplicatePriorities: number;
  originals: string;
}

/** یک گزینه‌ی گروه (اقلام اصلی یا یک جایگزین) با اقلامش. */
export interface OptionRow {
  groupCode: string;
  optionNo: number;
  title: string;
  priority: number | null;
  items: { product: string; quantity: string; hasRole: boolean }[];
  /** «۱٫۰۵ kg مانیتول» — متن کوتاه برای نمودار. */
  summary: string;
  description: string;
}

export interface UsageRow {
  groupCode: string;
  structure: string;
  revision: string;
  isCurrent: boolean;
  item: string;
  consistent: boolean;
}

export interface GroupIssue {
  tone: 'danger' | 'warning' | 'info';
  text: string;
}
