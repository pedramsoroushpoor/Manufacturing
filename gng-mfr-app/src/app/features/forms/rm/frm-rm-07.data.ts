/**
 * شکل ردیف‌هایی که قالب FRM-RM-07 مصرف می‌کند. داده از اسکیمای mes می‌آید
 * (frm-rm-07.service.ts)؛ این فرم داده‌ی Mock ندارد.
 */
export type ReasonCategory = 1 | 2 | 3 | 4;

export const CATEGORY_LABEL: Record<ReasonCategory, string> = {
  1: 'توقف',
  2: 'ضایعات',
  3: 'دوباره‌کاری',
  4: 'انحراف از برنامه',
};

export const CATEGORIES: ReasonCategory[] = [1, 2, 3, 4];

/** کدهای موقت تا رسیدن کدلیست اصلی (به سرآغاز mes_frm_rm07_setup.sql نگاه کنید). */
export const OEE_COMPONENT_LABEL: Record<number, string> = { 1: 'در دسترس‌بودن', 2: 'عملکرد', 3: 'کیفیت' };
export const STOPPAGE_TYPE_LABEL: Record<number, string> = { 1: 'برنامه‌ریزی‌شده', 2: 'برنامه‌ریزی‌نشده' };
export const WASTE_TYPE_LABEL: Record<number, string> = { 1: 'ضایعات مواد', 2: 'ضایعات محصول' };
export const DEVIATION_TYPE_LABEL: Record<number, string> = { 1: 'مقداری', 2: 'زمانی', 3: 'ترتیب' };
export const LEVEL_LABEL: Record<string, string> = {
  station: 'ایستگاه',
  'equipment-type': 'نوع تجهیز',
  line: 'خط',
  none: 'بدون محدودیت',
};

/** وضعیت OEE یک علت: نگاشت‌شده به یکی از شش زیان، خارج از OEE، نگاشت‌نشده، یا بی‌ربط (گروه، مواد، ...). */
export type OeeStatus = 'mapped' | 'excluded' | 'unmapped' | 'none';

/** یک گره‌ی درخت علل (گروه یا علت) — شکل مشترک هر چهار دسته. */
export interface ReasonNodeRow {
  key: string;
  code: string;
  title: string;
  isGroup: boolean;
  active: boolean;
  /** فقط برای علت توقف: برنامه‌ریزی‌شده / نشده. */
  typeLabel: string;
  oeeStatus: OeeStatus;
  oeeLabel: string;
  oeeComponent: string;
  ruleCount: number;
  description: string;
  /** شمار علل فعالِ زیر این گره (برای خودِ علت ۱). */
  leafCount: number;
  /** با انتخاب یک ایستگاه: شمار علل مجازِ زیر این گره؛ null یعنی ایستگاهی انتخاب نشده. */
  allowedCount: number | null;
}

export interface ReasonRef {
  code: string;
  title: string;
  parent: string;
  category: string;
  typeLabel: string;
}

export interface OeeLossRow {
  code: number;
  title: string;
  englishTitle: string;
  component: string;
  causes: ReasonRef[];
}

export interface RuleRow {
  level: string;
  levelCode: string;
  target: string;
  category: string;
  reason: string;
  isGroup: boolean;
  leafCount: number;
  description: string;
}

export interface AllowedCell {
  allowed: number;
  total: number;
  level: string;
  levelCode: string;
  source: string;
}

export interface StationAllowedRow {
  stationId: number;
  station: string;
  line: string;
  cells: AllowedCell[];
}
