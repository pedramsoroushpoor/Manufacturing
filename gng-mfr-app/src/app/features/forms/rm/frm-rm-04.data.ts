/**
 * شکل ردیف‌هایی که قالب FRM-RM-04 مصرف می‌کند. داده از اسکیمای mes می‌آید
 * (frm-rm-04.service.ts)؛ این فرم داده‌ی Mock ندارد.
 */

/** بخشی از نوار ۲۴ساعته: شروع و طول به درصدِ شبانه‌روز. */
export interface TimelineSegment {
  startPercent: number;
  widthPercent: number;
  kind: 'work' | 'paid-break' | 'unpaid-break';
  hint: string;
}

export interface ShiftRow {
  id: number;
  code: string;
  title: string;
  /** شماره‌ی رنگ ثابت این شیفت (۱ تا ۵) — در همه‌ی تب‌ها یکسان. */
  tone: number;
  start: string;
  end: string;
  grossText: string;
  unpaidBreakText: string;
  netText: string;
  crossesMidnight: boolean;
  isSplit: boolean;
  breaksText: string;
  segments: TimelineSegment[];
}

export interface RotationDayCell {
  dayNo: number;
  shift: ShiftRow | null;
}

export interface RotationRow {
  id: number;
  code: string;
  title: string;
  cycleDays: number;
  description: string;
  workDays: number;
  days: RotationDayCell[];
}

export interface AssignmentRow {
  group: string;
  rotation: string;
  startDate: string;
  offsetDays: number;
  /** روز چرخه در اولین روزِ پنجره‌ی نمایش. */
  cycleDayText: string;
}

export interface RosterDay {
  iso: string;
  weekday: string;
  dayText: string;
  monthText: string;
  isFriday: boolean;
  isToday: boolean;
}

export interface RosterCell {
  shift: ShiftRow | null;
  shiftTitle: string;
  planned: number;
  absent: number;
  substitutes: number;
  available: number;
  shortage: boolean;
  hint: string;
}

export interface RosterGroupRow {
  group: string;
  cells: (RosterCell | null)[];
}

export interface RosterGrid {
  days: RosterDay[];
  rows: RosterGroupRow[];
  /** به‌ازای هر روز: حاضر و برنامه‌ای، جمعِ همه‌ی گروه‌های دامنه. */
  totals: { planned: number; available: number; percent: number | null }[];
}

export interface ShortageRow {
  group: string;
  date: string;
  shift: string;
  available: number;
  planned: number;
}

export type AbsenceType = 'leave' | 'absent' | 'training';

export const ABSENCE_LABEL: Record<AbsenceType, string> = {
  leave: 'مرخصی',
  absent: 'غیبت',
  training: 'آموزش / مأموریت',
};

export interface AbsenceRow {
  date: string;
  person: string;
  group: string;
  shift: string;
  type: AbsenceType;
  substitute: string;
  description: string;
  effect: 'covered' | 'shortage' | 'rest-day';
}
