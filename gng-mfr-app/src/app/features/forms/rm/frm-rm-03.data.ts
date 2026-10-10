/**
 * شکل ردیف‌هایی که قالب FRM-RM-03 مصرف می‌کند. داده از اسکیمای mes می‌آید
 * (frm-rm-03.service.ts)؛ این فرم داده‌ی Mock ندارد — اگر API در دسترس نباشد
 * همین را در بنر می‌گوید.
 */

/** کد موقت سطح مهارت تا رسیدن کدلیست اصلی. */
export const SKILL_LEVEL_LABEL: Record<number, string> = {
  1: 'کارآموز',
  2: 'با نظارت',
  3: 'مستقل',
  4: 'مربی',
};

/** سطحی که از آن به بالا، نفر مهارت را بدون نظارت انجام می‌دهد. */
export const INDEPENDENT_LEVEL = 3;

export type ValidityStatus = 'valid' | 'expiring' | 'retraining' | 'expired';

export const VALIDITY_LABEL: Record<ValidityStatus, string> = {
  valid: 'معتبر',
  expiring: 'نزدیک موعد',
  retraining: 'موعد بازآموزی گذشته',
  expired: 'منقضی',
};

export interface PersonnelRow {
  id: number;
  code: string;
  name: string;
  post: string;
  orgNode: string;
  personnelGroup: string;
  workingGroup: string;
  stations: string;
  stationCount: number;
  maxStations: number;
  engagement: number;
  validSkillCount: number;
  independentSkillCount: number;
  multiSkilled: boolean;
  /** بیش از سقف ایستگاه هم‌زمان، یا مجموع اشتغال بالای ۱۰۰٪. */
  concurrencyViolation: boolean;
  nextRetraining: string;
  active: boolean;
}

export interface SkillRow {
  id: number;
  code: string;
  title: string;
  category: string;
  retraining: string;
  holderCount: number;
  independentCount: number;
}

export interface RequirementRow {
  operation: string;
  skill: string;
  minLevel: number;
  minLevelLabel: string;
  mode: 'block' | 'warn';
  qualifiedCount: number;
}

export interface MatrixCell {
  level: number;
  levelLabel: string;
  status: ValidityStatus;
  /** متن کامل برای tooltip و صفحه‌خوان. */
  hint: string;
}

export interface SkillMatrix {
  skills: SkillRow[];
  rows: { person: PersonnelRow; cells: (MatrixCell | null)[] }[];
  /** به‌ازای هر مهارت: تعداد نفر معتبر با سطح مستقل به بالا. */
  coverage: number[];
}

export interface ValidityIssueRow {
  person: string;
  skill: string;
  level: string;
  status: ValidityStatus;
  date: string;
}

export interface WorkingGroupRow {
  code: string;
  title: string;
  assignedTo: string;
  head: string;
  memberCount: number;
  members: string;
}

export interface ConcurrencyRow {
  person: string;
  stations: { label: string; percent: number; head: boolean }[];
  stationCount: number;
  maxStations: number;
  engagement: number;
  violation: boolean;
  reason: string;
}
