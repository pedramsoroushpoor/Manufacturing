import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import {
  ApprovalStatus,
  BASE_ORIGIN_LABEL,
  BaseOrigin,
  CalendarRuleRow,
  ConflictRow,
  EffectiveDayCell,
  EffectiveGrid,
  ExceptionKind,
  ExceptionRow,
  FreeSlotRow,
  InheritanceRow,
  ShutdownRow,
} from './frm-rm-05.data';
import { LEVEL_LABELS, RmSelection, scopeQuery } from './rm-scope';
import { addDays, buildWindowDays, fa, faDate, faFullDate, faHours, faTime, isoDay, windowText, workDaysText } from './rm-time';

interface RuleApiRow {
  Code: string;
  Title: string;
  LevelKind: 'org' | 'line' | 'station';
  OrgLevelCode: string | null;
  LevelTitle: string | null;
  WorkDaysMask: number;
  FromTime: number;
  ToTime: number;
  Is24x7: boolean;
  CampaignDays: number | null;
  Description: string | null;
}
interface InheritanceApiRow {
  LineTitle: string;
  RuleCode: string | null;
  RuleTitle: string | null;
  IsInherited: boolean;
  SourceTitle: string | null;
  SourceLevelCode: string | null;
}
interface EffectiveApiRow {
  CalendarDate: string;
  LineId: number;
  LineTitle: string;
  BaseMinutes: number;
  BaseOrigin: BaseOrigin;
  ShiftMinutes: number;
  ExceptionMinutes: number;
  MaintenanceMinutes: number;
  PlannedCount: number;
  AvailableCount: number;
  EffectiveMinutes: number;
  FreeMinutes: number;
}
interface ExceptionApiRow {
  FromDate: string;
  ToDate: string;
  ExceptionTypeCode: number;
  FromTime: number | null;
  ToTime: number | null;
  ApprovalStatusCode: number;
  Description: string | null;
  RequestedByTitle: string | null;
  ApprovedByTitle: string | null;
  ScopeTitle: string | null;
  ScopeLevelCode: string | null;
  AffectedLines: number;
}
interface ShutdownApiRow {
  CalendarDate: string;
  ShutdownTypeCode: number;
  LineTitle: string | null;
  StationCode: string | null;
  StationTitle: string | null;
  PlannedStartTime: number;
  PlannedEndTime: number | null;
  PlannedDuration: number | null;
  Description: string | null;
  RequestedByTitle: string | null;
}
interface BundleApi {
  from: string;
  days: number;
  today: string;
  rules: RuleApiRow[];
  inheritance: InheritanceApiRow[];
  effective: EffectiveApiRow[];
  exceptions: ExceptionApiRow[];
  shutdowns: ShutdownApiRow[];
}

/** همه‌ی داده‌ی فرم برای یک دامنه‌ی انتخاب و یک پنجره‌ی زمانی. */
export interface FrmRm05Bundle {
  from: string;
  today: string;
  windowText: string;
  rules: CalendarRuleRow[];
  inheritance: InheritanceRow[];
  effective: EffectiveGrid;
  conflicts: ConflictRow[];
  exceptions: ExceptionRow[];
  shutdowns: ShutdownRow[];
  freeSlots: FreeSlotRow[];
}

/** کدهای موقت تا رسیدن کدلیست اصلی (به سرآغاز mes_frm_rm05_setup.sql نگاه کنید). */
const EXCEPTION_KIND: Record<number, ExceptionKind> = { 1: 'holiday', 2: 'closure', 3: 'extra-day' };
const APPROVAL: Record<number, ApprovalStatus> = { 1: 'pending', 2: 'approved', 3: 'rejected' };
const SHUTDOWN_LABEL: Record<number, string> = { 1: 'نت پیشگیرانه', 2: 'تعمیر اساسی', 3: 'توقف برنامه‌ای غیر نت' };

/**
 * داده‌ی واقعی FRM-RM-05 را از gng-mfr-api می‌گیرد (SP های اسکیمای mes — به
 * scripts/mes_frm_rm05_setup.sql نگاه کنید).
 */
@Injectable({ providedIn: 'root' })
export class FrmRm05Service {
  constructor(private http: HttpClient) {}

  loadScope(selection: RmSelection, from: string | null, days = 14): Observable<FrmRm05Bundle> {
    const params: Record<string, string | number> = { ...scopeQuery(selection), days };
    if (from) params['from'] = from;
    return this.http.get<BundleApi>(`${API_BASE_URL}/api/rm05/bundle`, { params }).pipe(map((b) => this.build(b)));
  }

  shiftWindow(from: string, deltaDays: number): string {
    return addDays(from, deltaDays);
  }

  private build(b: BundleApi): FrmRm05Bundle {
    const days = buildWindowDays(b.from, b.days, b.today);
    const dayIndex = new Map(days.map((d, i) => [d.iso, i]));

    const lines = new Map<number, { line: string; cells: (EffectiveDayCell | null)[]; total: number }>();
    const conflicts: ConflictRow[] = [];
    const freeSlots: FreeSlotRow[] = [];
    for (const r of b.effective) {
      if (!lines.has(r.LineId)) lines.set(r.LineId, { line: r.LineTitle, cells: days.map(() => null), total: 0 });
      const i = dayIndex.get(isoDay(r.CalendarDate));
      if (i === undefined) continue;
      const conflict = r.BaseMinutes === 0 && r.ShiftMinutes > 0 && (r.BaseOrigin === 'holiday' || r.BaseOrigin === 'closure');
      const parts = [
        `پایه ${faHours(r.BaseMinutes)} ساعت (${BASE_ORIGIN_LABEL[r.BaseOrigin]})`,
        `شیفت ${faHours(r.ShiftMinutes)} ساعت`,
      ];
      if (r.ExceptionMinutes) parts.push(`تعطیلی جزئی ${faHours(r.ExceptionMinutes)} ساعت`);
      if (r.MaintenanceMinutes) parts.push(`رزرو نت ${faHours(r.MaintenanceMinutes)} ساعت`);
      parts.push(`در دسترس ${faHours(r.EffectiveMinutes)} ساعت`);
      const entry = lines.get(r.LineId)!;
      entry.cells[i] = {
        baseMinutes: r.BaseMinutes,
        baseOrigin: r.BaseOrigin,
        shiftMinutes: r.ShiftMinutes,
        exceptionMinutes: r.ExceptionMinutes,
        maintenanceMinutes: r.MaintenanceMinutes,
        planned: r.PlannedCount,
        available: r.AvailableCount,
        effectiveMinutes: r.EffectiveMinutes,
        conflict,
        hint: parts.join(' · '),
      };
      entry.total += r.EffectiveMinutes;
      if (conflict) {
        conflicts.push({ line: r.LineTitle, date: faFullDate(r.CalendarDate), origin: BASE_ORIGIN_LABEL[r.BaseOrigin] });
      }
      if (r.FreeMinutes > 0) {
        freeSlots.push({
          line: r.LineTitle,
          date: faFullDate(r.CalendarDate),
          weekday: days[i].weekday,
          freeHours: faHours(r.FreeMinutes),
          reason: r.ShiftMinutes === 0 ? 'روز کاریِ بدون شیفت' : 'ساعت کاریِ بدون شیفت',
        });
      }
    }

    return {
      from: b.from,
      today: b.today,
      windowText: windowText(b.from, b.days),
      rules: b.rules.map((r) => ({
        code: r.Code,
        title: r.Title,
        level: r.LevelKind === 'line' ? 'خط' : r.LevelKind === 'station' ? 'ایستگاه' : (LEVEL_LABELS[r.OrgLevelCode ?? ''] ?? 'سازمانی'),
        levelTitle: r.LevelTitle ?? '—',
        workDays: r.Is24x7 ? 'همه‌ی روزها' : workDaysText(r.WorkDaysMask),
        hours: r.Is24x7 ? '۲۴ ساعته' : `${faTime(r.FromTime)} تا ${faTime(r.ToTime)}`,
        continuous: r.Is24x7,
        campaign: r.CampaignDays ? `کمپین ${fa(r.CampaignDays)} روزه` : '—',
        description: r.Description ?? '—',
      })),
      inheritance: b.inheritance.map((r) => ({
        line: r.LineTitle,
        rule: r.RuleCode ? `${r.RuleTitle} (${r.RuleCode})` : 'بدون تقویم',
        source: r.RuleCode
          ? r.IsInherited
            ? `${LEVEL_LABELS[r.SourceLevelCode ?? ''] ?? ''} — ${r.SourceTitle ?? ''}`.trim()
            : 'تعریف روی خودِ خط'
          : '—',
        inherited: r.IsInherited,
        hasRule: !!r.RuleCode,
      })),
      effective: {
        days,
        lines: [...lines.entries()].map(([lineId, v]) => ({
          lineId,
          line: v.line,
          cells: v.cells,
          totalHours: faHours(v.total),
        })),
      },
      conflicts,
      exceptions: b.exceptions.map((x): ExceptionRow => {
        const from = isoDay(x.FromDate);
        const to = isoDay(x.ToDate);
        return {
          dates: from === to ? faFullDate(from) : `${faFullDate(from)} تا ${faFullDate(to)}`,
          kind: EXCEPTION_KIND[x.ExceptionTypeCode] ?? 'closure',
          scope: `${LEVEL_LABELS[x.ScopeLevelCode ?? ''] ?? ''} — ${x.ScopeTitle ?? ''}`.replace(/^ — /, ''),
          time: x.FromTime === null || x.ToTime === null ? 'تمام روز' : `${faTime(x.FromTime)} تا ${faTime(x.ToTime)}`,
          description: x.Description ?? '—',
          status: APPROVAL[x.ApprovalStatusCode] ?? 'pending',
          requestedBy: x.RequestedByTitle ?? '—',
          approvedBy: x.ApprovedByTitle ?? '—',
          affectedLines: x.AffectedLines,
        };
      }),
      shutdowns: b.shutdowns.map((m) => ({
        date: `${faDate(m.CalendarDate, { weekday: 'long' })} ${faFullDate(m.CalendarDate)}`,
        type: SHUTDOWN_LABEL[m.ShutdownTypeCode] ?? `نوع ${fa(m.ShutdownTypeCode)}`,
        location: m.StationCode ? `${m.LineTitle} · ${m.StationCode} — ${m.StationTitle}` : `${m.LineTitle} (کل خط)`,
        time: m.PlannedEndTime === null ? faTime(m.PlannedStartTime) : `${faTime(m.PlannedStartTime)} تا ${faTime(m.PlannedEndTime)}`,
        hours: faHours(m.PlannedDuration ?? 0),
        description: m.Description ?? '—',
        requestedBy: m.RequestedByTitle ?? '—',
      })),
      freeSlots,
    };
  }
}
