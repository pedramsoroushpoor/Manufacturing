import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import {
  AvailabilityRow,
  BASIS_LABEL,
  COLLECTION_LABEL,
  CapacityRow,
  CapacityTypeRow,
  HistoryRow,
  LoadCell,
  LoadGrid,
  LoadRow,
  LoadSeverity,
  ProductRateRow,
  VersionStatus,
} from './frm-rm-06.data';
import { RmSelection, scopeQuery } from './rm-scope';
import { addDays, buildWindowDays, fa, faFullDate, isoDay, windowText } from './rm-time';

type ResourceKind = 'station' | 'group';

interface TypeApiRow {
  Code: string;
  Title: string;
  UnitTitle: string;
  MeasureBasisCode: number;
  CollectionMethodCode: number;
  CalculationFormula: string | null;
  CollectionNote: string | null;
  IsBuiltIn: boolean;
  LegacyFieldCode: string | null;
  IsActive: boolean;
  ResourceCount: number;
  ProductRateCount: number;
}
interface CapacityApiRow {
  ResourceKind: ResourceKind;
  ResourceTitle: string;
  LineTitle: string | null;
  TypeTitle: string;
  UnitTitle: string;
  MeasureBasisCode: number;
  CapacityQuantity: number;
  AvailableCount: number | null;
  EquipmentAvailPercent: number;
  ProductivityPercent: number;
  StandardDowntime: number | null;
  ValidFromDate: string;
  ValidToDate: string | null;
  VersionStatus: VersionStatus;
  EffectivePerHour: number;
  ChangeReason: string | null;
}
interface ProductRateApiRow {
  ResourceKind: ResourceKind;
  ResourceTitle: string;
  LineTitle: string | null;
  ProductTitle: string;
  IsProductGroup: boolean;
  RatePerHour: number;
  RateUnitTitle: string;
  EfficiencyFactor: number;
  EffectiveRate: number;
  ValidFromDate: string;
  ValidToDate: string | null;
  VersionStatus: VersionStatus;
}
interface LoadApiRow {
  ResourceKind: ResourceKind;
  ResourceId: number;
  ResourceTitle: string;
  LineTitle: string | null;
  CapacityTypeId: number;
  TypeTitle: string;
  UnitTitle: string;
  CalendarDate: string;
  CapacityQty: number | null;
  LoadQty: number;
}
interface HistoryApiRow {
  HistoryKind: 'capacity' | 'product-rate';
  ResourceTitle: string;
  LineTitle: string | null;
  TypeTitle: string;
  UnitTitle: string;
  ProductTitle: string | null;
  ValidFromDate: string;
  Value: number;
  PreviousValue: number | null;
  Detail: string;
  ChangeReason: string | null;
  ChangedByTitle: string | null;
}
interface BundleApi {
  from: string;
  days: number;
  today: string;
  types: TypeApiRow[];
  capacities: CapacityApiRow[];
  productRates: ProductRateApiRow[];
  load: LoadApiRow[];
  history: HistoryApiRow[];
}

/** همه‌ی داده‌ی فرم برای یک دامنه‌ی انتخاب و یک پنجره‌ی زمانی. */
export interface FrmRm06Bundle {
  from: string;
  today: string;
  windowText: string;
  types: CapacityTypeRow[];
  capacities: CapacityRow[];
  availability: AvailabilityRow[];
  productRates: ProductRateRow[];
  load: LoadGrid;
  history: HistoryRow[];
}

/** آستانه‌های نمای بار: از ۹۰٪ هشدار، بالای ۱۰۰٪ گلوگاه. */
export const LOAD_WARN_PERCENT = 90;

function severityOf(percent: number | null, load: number): LoadSeverity {
  if (percent === null) return load > 0 ? 'nocap' : 'idle';
  if (percent > 100) return 'over';
  if (percent >= LOAD_WARN_PERCENT) return 'warn';
  return load > 0 ? 'ok' : 'idle';
}

const pct = (load: number, cap: number | null): number | null =>
  cap === null ? null : cap > 0 ? Math.round((100 * load) / cap) : load > 0 ? Infinity : 0;

function validityText(from: string, to: string | null): string {
  return to ? `${faFullDate(isoDay(from))} تا ${faFullDate(isoDay(to))}` : `از ${faFullDate(isoDay(from))}`;
}

/** متنی که SQL با FORMAT ساخته (رقم لاتین، «,» و «.») را به رقم و جداکننده‌ی فارسی برمی‌گرداند. */
const faDigits = (text: string): string =>
  text
    .replace(/(\d),(\d)/g, '$1٬$2')
    .replace(/(\d)\.(\d)/g, '$1٫$2')
    .replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);

const resourceLabel =(kind: ResourceKind, title: string) => (kind === 'group' ? `${title} (گروه منبع)` : title);

/**
 * داده‌ی واقعی FRM-RM-06 را از gng-mfr-api می‌گیرد (SP های اسکیمای mes — به
 * scripts/mes_frm_rm06_setup.sql نگاه کنید).
 */
@Injectable({ providedIn: 'root' })
export class FrmRm06Service {
  constructor(private http: HttpClient) {}

  loadScope(selection: RmSelection, from: string | null, days = 14): Observable<FrmRm06Bundle> {
    const params: Record<string, string | number> = { ...scopeQuery(selection), days };
    if (from) params['from'] = from;
    return this.http.get<BundleApi>(`${API_BASE_URL}/api/rm06/bundle`, { params }).pipe(map((b) => this.build(b)));
  }

  shiftWindow(from: string, deltaDays: number): string {
    return addDays(from, deltaDays);
  }

  private build(b: BundleApi): FrmRm06Bundle {
    return {
      from: b.from,
      today: b.today,
      windowText: windowText(b.from, b.days),
      types: b.types.map((t) => ({
        code: t.Code,
        title: t.Title,
        unit: t.UnitTitle,
        basis: BASIS_LABEL[t.MeasureBasisCode] ?? '—',
        collection: COLLECTION_LABEL[t.CollectionMethodCode] ?? '—',
        collectionDetail: t.CalculationFormula ?? t.CollectionNote ?? '—',
        builtIn: t.IsBuiltIn,
        legacy: t.LegacyFieldCode === 'Machine' ? 'MachineLoad' : t.LegacyFieldCode === 'Labor' ? 'LaborLoad' : '',
        active: t.IsActive,
        resourceCount: t.ResourceCount,
        rateCount: t.ProductRateCount,
      })),
      capacities: b.capacities.map((c) => ({
        resource: resourceLabel(c.ResourceKind, c.ResourceTitle),
        isGroup: c.ResourceKind === 'group',
        line: c.LineTitle ?? '—',
        type: c.TypeTitle,
        basis: BASIS_LABEL[c.MeasureBasisCode] ?? '—',
        defined:
          c.MeasureBasisCode === 1
            ? `${fa(c.CapacityQuantity)} واحد هم‌زمان`
            : c.MeasureBasisCode === 2
              ? `${fa(c.CapacityQuantity)} ${c.UnitTitle} در ساعت`
              : `${fa(c.CapacityQuantity)} ${c.UnitTitle}`,
        effective: c.MeasureBasisCode === 3 ? 'ثابت' : `${fa(c.EffectivePerHour)} ${c.UnitTitle} در ساعت`,
        validity: validityText(c.ValidFromDate, c.ValidToDate),
        status: c.VersionStatus,
        reason: c.ChangeReason ?? '—',
      })),
      availability: b.capacities
        .filter((c) => c.MeasureBasisCode !== 3)
        .map((c) => {
          const available = c.AvailableCount ?? c.CapacityQuantity;
          return {
            resource: resourceLabel(c.ResourceKind, c.ResourceTitle),
            isGroup: c.ResourceKind === 'group',
            line: c.LineTitle ?? '—',
            type: c.TypeTitle,
            count: c.MeasureBasisCode === 1 ? `${fa(available)} از ${fa(c.CapacityQuantity)}` : '—',
            availPercent: `${fa(c.EquipmentAvailPercent)}٪`,
            productivityPercent: `${fa(c.ProductivityPercent)}٪`,
            downtime: c.StandardDowntime ? `${fa(c.StandardDowntime)} دقیقه در هر شیفت` : '—',
            status: c.VersionStatus,
            short: c.MeasureBasisCode === 1 && available < c.CapacityQuantity,
          };
        }),
      productRates: b.productRates.map((p) => ({
        resource: resourceLabel(p.ResourceKind, p.ResourceTitle),
        isGroup: p.ResourceKind === 'group',
        line: p.LineTitle ?? '—',
        product: p.ProductTitle,
        isProductGroup: p.IsProductGroup,
        rate: `${fa(p.RatePerHour)} ${p.RateUnitTitle} در ساعت`,
        efficiency: fa(p.EfficiencyFactor),
        effectiveRate: `${fa(p.EffectiveRate)} ${p.RateUnitTitle} در ساعت`,
        validity: validityText(p.ValidFromDate, p.ValidToDate),
        status: p.VersionStatus,
      })),
      load: this.buildLoad(b),
      history: b.history.map((h): HistoryRow => {
        const change = h.PreviousValue ? ((h.Value - h.PreviousValue) / h.PreviousValue) * 100 : null;
        return {
          date: faFullDate(isoDay(h.ValidFromDate)),
          kind: h.HistoryKind === 'capacity' ? 'ظرفیت' : 'نرخ محصول',
          resource: h.ResourceTitle,
          line: h.LineTitle ?? '—',
          target: h.ProductTitle ? `${h.TypeTitle} — ${h.ProductTitle}` : h.TypeTitle,
          detail: faDigits(h.Detail),
          value: `${fa(h.Value)} ${h.UnitTitle}`,
          previous: h.PreviousValue === null ? 'تعریف اولیه' : `${fa(h.PreviousValue)} ${h.UnitTitle}`,
          change: change === null ? '—' : `${change > 0 ? '+' : ''}${fa(Math.round(change * 10) / 10)}٪`,
          changeTone: change === null || change === 0 ? 'none' : change > 0 ? 'up' : 'down',
          reason: h.ChangeReason ?? '—',
          changedBy: h.ChangedByTitle ?? '—',
          isFuture: isoDay(h.ValidFromDate) > b.today,
        };
      }),
    };
  }

  /** ردیف‌های «منبع × نوع کارکرد» با جمع پنجره و یک سلول به‌ازای هر روز. */
  private buildLoad(b: BundleApi): LoadGrid {
    const days = buildWindowDays(b.from, b.days, b.today);
    const dayIndex = new Map(days.map((d, i) => [d.iso, i]));
    const groups = new Map<string, { first: LoadApiRow; cap: number | null; load: number; daily: (LoadApiRow | null)[] }>();
    for (const r of b.load) {
      const key = `${r.ResourceKind}-${r.ResourceId}-${r.CapacityTypeId}`;
      if (!groups.has(key)) groups.set(key, { first: r, cap: null, load: 0, daily: days.map(() => null) });
      const g = groups.get(key)!;
      if (r.CapacityQty !== null) g.cap = (g.cap ?? 0) + r.CapacityQty;
      g.load += r.LoadQty;
      const i = dayIndex.get(isoDay(r.CalendarDate));
      if (i !== undefined) g.daily[i] = r;
    }

    const rows: LoadRow[] = [...groups.values()].map((g) => {
      const unit = g.first.UnitTitle;
      const percent = pct(g.load, g.cap);
      const cells: LoadCell[] = g.daily.map((d) => {
        if (!d) return { percent: null, severity: 'idle', hint: '' };
        if (d.CapacityQty === 0 && d.LoadQty === 0) {
          return { percent: null, severity: 'idle', hint: `${faFullDate(isoDay(d.CalendarDate))} · خط ساعت در دسترس ندارد` };
        }
        const p = pct(d.LoadQty, d.CapacityQty);
        const capText = d.CapacityQty === null ? 'ظرفیت تعریف نشده' : `ظرفیت ${fa(d.CapacityQty)} ${unit}`;
        return {
          percent: p === Infinity ? null : p,
          severity: p === Infinity ? 'over' : severityOf(p, d.LoadQty),
          hint: `${faFullDate(isoDay(d.CalendarDate))} · ${capText} · بار ${fa(d.LoadQty)} ${unit}`,
        };
      });
      return {
        resource: resourceLabel(g.first.ResourceKind, g.first.ResourceTitle),
        isGroup: g.first.ResourceKind === 'group',
        line: g.first.LineTitle ?? '—',
        type: g.first.TypeTitle,
        unit,
        capacity: g.cap === null ? 'تعریف نشده' : `${fa(Math.round(g.cap * 10) / 10)} ${unit}`,
        load: `${fa(Math.round(g.load * 10) / 10)} ${unit}`,
        percent: percent === Infinity ? null : percent,
        severity: percent === Infinity ? 'over' : severityOf(percent, g.load),
        hasLoad: g.load > 0,
        cells,
      };
    });
    return { days, rows };
  }
}
