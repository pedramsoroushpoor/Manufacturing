import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import {
  AttributeRow,
  CapabilityRow,
  ChangeoverMatrix,
  EquipmentRow,
  MaintenanceCode,
  SoftwareVersionRow,
  ToolRow,
  ToolSeverity,
} from './frm-rm-02.data';
import { RmSelection, scopeQuery } from './rm-scope';

interface EquipmentApiRow {
  EquipmentId: number;
  ParentEquipmentId: number | null;
  Code: string;
  Title: string;
  EquipmentType: string | null;
  ParentCode: string | null;
  OrgNodeTitle: string;
  LineTitle: string | null;
  StationCode: string | null;
  MaintenanceStatus: MaintenanceCode;
  CumulativeHours: number;
  CumulativeUpdatedAt: string | null;
  IsActive: boolean;
}
interface AttributeApiRow {
  EquipmentCode: string;
  EquipmentTitle: string;
  AttributeTitle: string;
  ValueText: string;
  UnitTitle: string | null;
}
interface CapabilityApiRow {
  EquipmentCode: string;
  EquipmentTitle: string;
  OperationTitle: string;
  ProductRangeText: string | null;
  NominalRate: number | null;
  RateUnit: string | null;
  RequiredToolCode: string | null;
  RequiredToolTitle: string | null;
  RequiredToolText: string | null;
}
interface ToolApiRow {
  Code: string;
  Title: string;
  EquipmentCode: string | null;
  EquipmentTitle: string | null;
  OrgNodeTitle: string;
  LifeUnit: string;
  LifeLimit: number;
  LifeUsed: number;
  NextServiceAt: number | null;
  ServiceTitle: string | null;
  LifePercent: number;
}
interface ChangeoverApiRow {
  EquipmentId: number;
  EquipmentCode: string;
  EquipmentTitle: string;
  FromTitle: string;
  FromSort: number;
  ToTitle: string;
  ToSort: number;
  Minutes: number;
}
interface SoftwareApiRow {
  EquipmentCode: string;
  EquipmentTitle: string;
  SoftwareTitle: string;
  CurrentVersion: string;
  LatestVersion: string | null;
  UpdatedOn: string | null;
  IsUpToDate: boolean;
}
interface BundleApi {
  equipment: EquipmentApiRow[];
  attributes: AttributeApiRow[];
  capabilities: CapabilityApiRow[];
  tools: ToolApiRow[];
  changeover: ChangeoverApiRow[];
  software: SoftwareApiRow[];
}

/** همه‌ی داده‌ی فرم برای یک دامنه‌ی انتخاب، با همان شکل‌هایی که قالب HTML مصرف می‌کند. */
export interface FrmRm02Bundle {
  equipment: EquipmentRow[];
  attributes: AttributeRow[];
  capabilities: CapabilityRow[];
  tools: ToolRow[];
  changeover: ChangeoverMatrix[];
  software: SoftwareVersionRow[];
}

/** ابزاری که به این درصد از عمر مفید برسد «نیازمند تعویض» است. */
export const TOOL_REPLACE_PERCENT = 90;
const TOOL_WARN_PERCENT = 75;

const fa = (n: number, digits = 0): string =>
  n.toLocaleString('fa-IR', { minimumFractionDigits: 0, maximumFractionDigits: digits });

const faDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';

const eqLabel = (code: string, title: string): string => `${code} — ${title}`;

/**
 * داده‌ی واقعی FRM-RM-02 را از gng-mfr-api می‌گیرد (SP های اسکیمای mes — به
 * scripts/mes_frm_rm02_setup.sql نگاه کنید). یک درخواست برای هر انتخاب درخت.
 */
@Injectable({ providedIn: 'root' })
export class FrmRm02Service {
  constructor(private http: HttpClient) {}

  loadScope(selection: RmSelection): Observable<FrmRm02Bundle> {
    return this.http
      .get<BundleApi>(`${API_BASE_URL}/api/rm02/bundle`, { params: scopeQuery(selection) })
      .pipe(
        map((b) => ({
          equipment: this.buildEquipment(b.equipment),
          attributes: b.attributes.map((a) => ({
            equipment: eqLabel(a.EquipmentCode, a.EquipmentTitle),
            attribute: a.AttributeTitle,
            value: a.ValueText,
            unit: a.UnitTitle ?? '—',
          })),
          capabilities: b.capabilities.map((c) => ({
            equipment: eqLabel(c.EquipmentCode, c.EquipmentTitle),
            operation: c.OperationTitle,
            productRange: c.ProductRangeText ?? '—',
            nominalRate: c.NominalRate === null ? '—' : `${fa(c.NominalRate, 2)} ${c.RateUnit ?? ''}`.trim(),
            requiredTool: c.RequiredToolCode
              ? eqLabel(c.RequiredToolCode, c.RequiredToolTitle ?? '')
              : (c.RequiredToolText ?? '—'),
          })),
          tools: b.tools.map((t) => this.buildTool(t)),
          changeover: this.buildChangeover(b.changeover),
          software: b.software.map((w) => ({
            equipment: eqLabel(w.EquipmentCode, w.EquipmentTitle),
            software: w.SoftwareTitle,
            currentVersion: w.CurrentVersion,
            latestVersion: w.LatestVersion ?? '—',
            updatedAt: faDate(w.UpdatedOn),
            status: w.IsUpToDate ? 'به‌روز' : 'نیازمند به‌روزرسانی',
          })),
        }))
      );
  }

  /** فهرست را به ترتیب سلسله‌مراتبی (والد، بعد فرزندانش) و با عمق هر ردیف برمی‌گرداند. */
  private buildEquipment(rows: EquipmentApiRow[]): EquipmentRow[] {
    const inScope = new Set(rows.map((r) => r.EquipmentId));
    const children = new Map<number | null, EquipmentApiRow[]>();
    for (const r of rows) {
      // والدی که بیرون از دامنه است دیده نمی‌شود؛ فرزندش مثل ریشه نمایش داده می‌شود.
      const key = r.ParentEquipmentId !== null && inScope.has(r.ParentEquipmentId) ? r.ParentEquipmentId : null;
      if (!children.has(key)) children.set(key, []);
      children.get(key)!.push(r);
    }
    const out: EquipmentRow[] = [];
    const walk = (parentId: number | null, depth: number): void => {
      for (const r of (children.get(parentId) ?? []).sort((a, b) => a.Code.localeCompare(b.Code))) {
        out.push({
          id: r.EquipmentId,
          code: r.Code,
          title: r.Title,
          depth,
          parent: r.ParentCode ?? '—',
          type: r.EquipmentType ?? '—',
          location: r.LineTitle
            ? r.StationCode
              ? `${r.LineTitle} · ایستگاه ${r.StationCode}`
              : r.LineTitle
            : r.OrgNodeTitle,
          status: r.IsActive ? 'فعال' : 'خارج از سرویس',
          hoursText: fa(r.CumulativeHours, 1),
          hoursUpdatedText: faDate(r.CumulativeUpdatedAt),
          maintenance: r.MaintenanceStatus,
        });
        walk(r.EquipmentId, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }

  private buildTool(t: ToolApiRow): ToolRow {
    const severity: ToolSeverity =
      t.LifePercent >= TOOL_REPLACE_PERCENT
        ? 'danger'
        : t.LifePercent >= TOOL_WARN_PERCENT
          ? 'warning'
          : t.LifePercent >= 50
            ? 'success'
            : 'info';
    const parts = [`${fa(t.LifeUsed)} از ${fa(t.LifeLimit)} ${t.LifeUnit}`];
    if (t.LifePercent >= TOOL_REPLACE_PERCENT) parts.push('نیازمند تعویض');
    else if (t.NextServiceAt !== null) parts.push(`${t.ServiceTitle ?? 'سرویس'} بعدی در ${fa(t.NextServiceAt)}`);
    return {
      code: t.Code,
      title: t.Title,
      mountedOn: t.EquipmentCode ? eqLabel(t.EquipmentCode, t.EquipmentTitle ?? '') : `انبار ابزار — ${t.OrgNodeTitle}`,
      lifePercent: t.LifePercent,
      severity,
      note: parts.join(' · '),
    };
  }

  /** سلول‌های تخت (از، به، دقیقه) را به یک ماتریس به‌ازای هر تجهیز تبدیل می‌کند. */
  private buildChangeover(rows: ChangeoverApiRow[]): ChangeoverMatrix[] {
    const byEquipment = new Map<number, ChangeoverApiRow[]>();
    for (const r of rows) {
      if (!byEquipment.has(r.EquipmentId)) byEquipment.set(r.EquipmentId, []);
      byEquipment.get(r.EquipmentId)!.push(r);
    }
    return [...byEquipment.values()].map((cells) => {
      const sortOf = new Map<string, number>();
      for (const c of cells) {
        sortOf.set(c.FromTitle, c.FromSort);
        sortOf.set(c.ToTitle, c.ToSort);
      }
      const classes = [...sortOf.keys()].sort((a, b) => sortOf.get(a)! - sortOf.get(b)!);
      const index = new Map(classes.map((c, i) => [c, i]));
      const matrix: (number | null)[][] = classes.map(() => classes.map(() => null));
      for (const c of cells) matrix[index.get(c.FromTitle)!][index.get(c.ToTitle)!] = c.Minutes;
      return { equipment: eqLabel(cells[0].EquipmentCode, cells[0].EquipmentTitle), classes, cells: matrix };
    });
  }
}
