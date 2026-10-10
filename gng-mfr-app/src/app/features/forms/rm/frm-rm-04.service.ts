import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import {
  AbsenceRow,
  AbsenceType,
  AssignmentRow,
  RosterCell,
  RosterDay,
  RosterGrid,
  RotationRow,
  ShiftRow,
  ShortageRow,
  TimelineSegment,
} from './frm-rm-04.data';
import { RmSelection, scopeQuery } from './rm-scope';

interface ShiftApiRow {
  ShiftId: number;
  Code: string;
  Title: string;
  FromTime: number;
  ToTime: number;
  GrossMinutes: number;
  UnpaidBreakMinutes: number;
  NetMinutes: number;
  CrossesMidnight: boolean;
  IsSplit: boolean;
}
interface BreakApiRow {
  ShiftId: number;
  Title: string;
  FromTime: number;
  ToTime: number;
  Minutes: number;
  IsPaid: boolean;
}
interface RotationDayApiRow {
  RotationId: number;
  Code: string;
  Title: string;
  CycleDays: number;
  Description: string | null;
  DayNo: number;
  ShiftId: number | null;
}
interface AssignmentApiRow {
  GroupCode: string;
  GroupTitle: string;
  RotationTitle: string;
  CycleDays: number;
  ValidFromDate: string;
  OffsetDays: number;
}
interface RosterApiRow {
  CalendarDate: string;
  GroupCode: string;
  GroupTitle: string;
  ShiftId: number;
  ShiftTitle: string;
  PlannedCount: number;
  AbsentCount: number;
  SubstituteCount: number;
  AvailableCount: number;
}
interface AbsenceApiRow {
  AbsenceDate: string;
  AbsenceType: AbsenceType;
  PersonnelCode: string;
  PersonnelTitle: string;
  GroupTitle: string;
  ShiftTitle: string | null;
  SubstituteTitle: string | null;
  Description: string | null;
}
interface BundleApi {
  from: string;
  days: number;
  today: string;
  shifts: ShiftApiRow[];
  breaks: BreakApiRow[];
  rotationDays: RotationDayApiRow[];
  assignments: AssignmentApiRow[];
  roster: RosterApiRow[];
  absences: AbsenceApiRow[];
}

/** همه‌ی داده‌ی فرم برای یک دامنه‌ی انتخاب و یک پنجره‌ی زمانی. */
export interface FrmRm04Bundle {
  from: string;
  days: number;
  today: string;
  windowText: string;
  shifts: ShiftRow[];
  rotations: RotationRow[];
  assignments: AssignmentRow[];
  roster: RosterGrid;
  shortages: ShortageRow[];
  absences: AbsenceRow[];
}

const DAY_MINUTES = 1440;
const WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

const fa = (n: number): string => n.toLocaleString('fa-IR', { maximumFractionDigits: 2 });

/** دقیقه از نیمه‌شب → «۰۶:۰۰». */
const faTime = (minutes: number): string => {
  const m = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const two = (n: number) => n.toLocaleString('fa-IR', { minimumIntegerDigits: 2, useGrouping: false });
  return `${two(Math.floor(m / 60))}:${two(m % 60)}`;
};

const faDuration = (minutes: number): string => {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!m) return `${fa(h)} ساعت`;
  if (!h) return `${fa(m)} دقیقه`;
  return `${fa(h)} ساعت و ${fa(m)} دقیقه`;
};

/** تاریخ‌ها «روز تقویمی»‌اند، نه لحظه: همیشه در UTC خوانده می‌شوند تا با منطقه‌ی زمانی مرورگر جابه‌جا نشوند. */
const isoDay = (value: string): string => value.slice(0, 10);
const utc = (iso: string): Date => new Date(`${isoDay(iso)}T00:00:00Z`);
const faDate = (iso: string, opts: Intl.DateTimeFormatOptions): string =>
  utc(iso).toLocaleDateString('fa-IR-u-ca-persian', { timeZone: 'UTC', ...opts });
const faFullDate = (iso: string): string => faDate(iso, { year: 'numeric', month: '2-digit', day: '2-digit' });
const addDays = (iso: string, n: number): string => {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dayDiff = (a: string, b: string): number => Math.round((utc(a).getTime() - utc(b).getTime()) / 86400000);

/** بازه‌ی [from, to) روی شبانه‌روز؛ اگر از نیمه‌شب بگذرد دو تکه می‌شود. */
function segments(from: number, to: number, kind: TimelineSegment['kind'], hint: string): TimelineSegment[] {
  const seg = (a: number, b: number): TimelineSegment => ({
    startPercent: (100 * a) / DAY_MINUTES,
    widthPercent: (100 * (b - a)) / DAY_MINUTES,
    kind,
    hint,
  });
  return to > from ? [seg(from, to)] : [seg(from, DAY_MINUTES), seg(0, to)];
}

/**
 * داده‌ی واقعی FRM-RM-04 را از gng-mfr-api می‌گیرد (SP های اسکیمای mes — به
 * scripts/mes_frm_rm04_setup.sql نگاه کنید). زمان‌ها در دیتابیس «دقیقه از
 * نیمه‌شب»‌اند.
 */
@Injectable({ providedIn: 'root' })
export class FrmRm04Service {
  constructor(private http: HttpClient) {}

  loadScope(selection: RmSelection, from: string | null, days = 14): Observable<FrmRm04Bundle> {
    const params: Record<string, string | number> = { ...scopeQuery(selection), days };
    if (from) params['from'] = from;
    return this.http.get<BundleApi>(`${API_BASE_URL}/api/rm04/bundle`, { params }).pipe(map((b) => this.build(b)));
  }

  shiftWindow(from: string, deltaDays: number): string {
    return addDays(from, deltaDays);
  }

  private build(b: BundleApi): FrmRm04Bundle {
    const shifts = b.shifts.map((s, i) => this.buildShift(s, i, b.breaks));
    const shiftOf = new Map(shifts.map((s) => [s.id, s]));
    const roster = this.buildRoster(b, shiftOf);
    const lastDay = addDays(b.from, b.days - 1);

    return {
      from: b.from,
      days: b.days,
      today: b.today,
      windowText: `${faFullDate(b.from)} تا ${faFullDate(lastDay)}`,
      shifts,
      rotations: this.buildRotations(b.rotationDays, shiftOf),
      assignments: b.assignments.map((a): AssignmentRow => {
        const start = isoDay(a.ValidFromDate);
        const diff = dayDiff(b.from, start);
        return {
          group: `${a.GroupTitle} (${a.GroupCode})`,
          rotation: a.RotationTitle,
          startDate: faFullDate(start),
          offsetDays: a.OffsetDays,
          cycleDayText:
            diff < 0 ? 'هنوز شروع نشده' : `روز ${fa(((diff + a.OffsetDays) % a.CycleDays) + 1)} از ${fa(a.CycleDays)}`,
        };
      }),
      roster,
      shortages: b.roster
        .filter((r) => r.AvailableCount < r.PlannedCount)
        .map((r) => ({
          group: r.GroupTitle,
          date: faFullDate(r.CalendarDate),
          shift: r.ShiftTitle,
          available: r.AvailableCount,
          planned: r.PlannedCount,
        })),
      absences: b.absences.map(
        (a): AbsenceRow => ({
          date: faFullDate(a.AbsenceDate),
          person: `${a.PersonnelTitle} (${a.PersonnelCode})`,
          group: a.GroupTitle,
          shift: a.ShiftTitle ?? '—',
          type: a.AbsenceType,
          substitute: a.SubstituteTitle ?? '—',
          description: a.Description ?? '—',
          effect: a.ShiftTitle === null ? 'rest-day' : a.SubstituteTitle ? 'covered' : 'shortage',
        })
      ),
    };
  }

  private buildShift(s: ShiftApiRow, index: number, breaks: BreakApiRow[]): ShiftRow {
    const own = breaks.filter((x) => x.ShiftId === s.ShiftId);
    const range = `${faTime(s.FromTime)} تا ${faTime(s.ToTime)}`;
    return {
      id: s.ShiftId,
      code: s.Code,
      title: s.Title,
      tone: (index % 5) + 1,
      start: faTime(s.FromTime),
      end: faTime(s.ToTime),
      grossText: faDuration(s.GrossMinutes),
      unpaidBreakText: faDuration(s.UnpaidBreakMinutes),
      netText: faDuration(s.NetMinutes),
      crossesMidnight: s.CrossesMidnight,
      isSplit: s.IsSplit,
      breaksText: own.length
        ? own
            .map((x) => `${x.Title} ${faTime(x.FromTime)}–${faTime(x.ToTime)}${x.IsPaid ? '' : ' (بدون مزد)'}`)
            .join('، ')
        : '—',
      segments: [
        ...segments(s.FromTime, s.ToTime, 'work', `${s.Title}: ${range}`),
        ...own.flatMap((x) =>
          segments(
            x.FromTime,
            x.ToTime,
            x.IsPaid ? 'paid-break' : 'unpaid-break',
            `${x.Title}: ${faTime(x.FromTime)} تا ${faTime(x.ToTime)}${x.IsPaid ? '' : ' — بدون مزد'}`
          )
        ),
      ],
    };
  }

  private buildRotations(rows: RotationDayApiRow[], shiftOf: Map<number, ShiftRow>): RotationRow[] {
    const byId = new Map<number, RotationRow>();
    for (const r of rows) {
      let rot = byId.get(r.RotationId);
      if (!rot) {
        rot = {
          id: r.RotationId,
          code: r.Code,
          title: r.Title,
          cycleDays: r.CycleDays,
          description: r.Description ?? '',
          workDays: 0,
          days: [],
        };
        byId.set(r.RotationId, rot);
      }
      const shift = r.ShiftId !== null ? (shiftOf.get(r.ShiftId) ?? null) : null;
      rot.days.push({ dayNo: r.DayNo, shift });
      if (shift) rot.workDays++;
    }
    return [...byId.values()];
  }

  private buildRoster(b: BundleApi, shiftOf: Map<number, ShiftRow>): RosterGrid {
    const days: RosterDay[] = Array.from({ length: b.days }, (_, i) => {
      const iso = addDays(b.from, i);
      const weekdayIndex = utc(iso).getUTCDay();
      return {
        iso,
        weekday: WEEKDAYS[weekdayIndex],
        dayText: faDate(iso, { day: 'numeric' }),
        monthText: faDate(iso, { month: 'long' }),
        isFriday: weekdayIndex === 5,
        isToday: iso === b.today,
      };
    });
    const dayIndex = new Map(days.map((d, i) => [d.iso, i]));

    // هر گروهی که چرخه دارد یک سطر می‌گیرد، حتی اگر در این پنجره شیفتی نداشته باشد.
    const groups = new Map<string, (RosterCell | null)[]>();
    for (const a of b.assignments) groups.set(a.GroupTitle, days.map(() => null));
    for (const r of b.roster) {
      if (!groups.has(r.GroupTitle)) groups.set(r.GroupTitle, days.map(() => null));
      const i = dayIndex.get(isoDay(r.CalendarDate));
      if (i === undefined) continue;
      const shortage = r.AvailableCount < r.PlannedCount;
      const parts = [`${r.ShiftTitle} — ${fa(r.AvailableCount)} از ${fa(r.PlannedCount)} نفر حاضر`];
      if (r.AbsentCount) parts.push(`${fa(r.AbsentCount)} غایب`);
      if (r.SubstituteCount) parts.push(`${fa(r.SubstituteCount)} جایگزین`);
      groups.get(r.GroupTitle)![i] = {
        shift: shiftOf.get(r.ShiftId) ?? null,
        shiftTitle: r.ShiftTitle,
        planned: r.PlannedCount,
        absent: r.AbsentCount,
        substitutes: r.SubstituteCount,
        available: r.AvailableCount,
        shortage,
        hint: parts.join(' · '),
      };
    }

    const rows = [...groups.entries()].map(([group, cells]) => ({ group, cells }));
    const totals = days.map((_, i) => {
      const cells = rows.map((r) => r.cells[i]).filter((c): c is RosterCell => c !== null);
      const planned = cells.reduce((s, c) => s + c.planned, 0);
      const available = cells.reduce((s, c) => s + c.available, 0);
      return { planned, available, percent: planned ? Math.round((100 * available) / planned) : null };
    });
    return { days, rows, totals };
  }
}
