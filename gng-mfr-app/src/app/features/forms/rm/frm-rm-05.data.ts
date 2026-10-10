import { WindowDay } from './rm-time';

/**
 * شکل ردیف‌هایی که قالب FRM-RM-05 مصرف می‌کند. داده از اسکیمای mes می‌آید
 * (frm-rm-05.service.ts)؛ این فرم داده‌ی Mock ندارد.
 */
export interface CalendarRuleRow {
  code: string;
  title: string;
  level: string;
  levelTitle: string;
  workDays: string;
  hours: string;
  continuous: boolean;
  campaign: string;
  description: string;
}

export interface InheritanceRow {
  line: string;
  rule: string;
  source: string;
  inherited: boolean;
  hasRule: boolean;
}

export type BaseOrigin = 'rule' | 'weekend' | 'holiday' | 'closure' | 'extra-day' | 'no-rule';

export const BASE_ORIGIN_LABEL: Record<BaseOrigin, string> = {
  rule: 'تقویم پایه',
  weekend: 'آخر هفته',
  holiday: 'تعطیل رسمی',
  closure: 'تعطیلی',
  'extra-day': 'روز کاری فوق‌العاده',
  'no-rule': 'بدون تقویم',
};

export interface EffectiveDayCell {
  baseMinutes: number;
  baseOrigin: BaseOrigin;
  shiftMinutes: number;
  exceptionMinutes: number;
  maintenanceMinutes: number;
  planned: number;
  available: number;
  effectiveMinutes: number;
  /** برای روز تعطیل شیفت برنامه‌ریزی شده است. */
  conflict: boolean;
  hint: string;
}

export interface EffectiveLine {
  lineId: number;
  line: string;
  cells: (EffectiveDayCell | null)[];
  totalHours: string;
}

export interface EffectiveGrid {
  days: WindowDay[];
  lines: EffectiveLine[];
}

export type ExceptionKind = 'holiday' | 'closure' | 'extra-day';

export const EXCEPTION_LABEL: Record<ExceptionKind, string> = {
  holiday: 'تعطیل رسمی',
  closure: 'تعطیلی فوق‌العاده',
  'extra-day': 'روز کاری فوق‌العاده',
};

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export const APPROVAL_LABEL: Record<ApprovalStatus, string> = {
  pending: 'در انتظار تأیید',
  approved: 'تأییدشده',
  rejected: 'ردشده',
};

export interface ExceptionRow {
  dates: string;
  kind: ExceptionKind;
  scope: string;
  time: string;
  description: string;
  status: ApprovalStatus;
  requestedBy: string;
  approvedBy: string;
  affectedLines: number;
}

export interface ShutdownRow {
  date: string;
  type: string;
  location: string;
  time: string;
  hours: string;
  description: string;
  requestedBy: string;
}

export interface FreeSlotRow {
  line: string;
  date: string;
  weekday: string;
  freeHours: string;
  reason: string;
}

export interface ConflictRow {
  line: string;
  date: string;
  origin: string;
}
