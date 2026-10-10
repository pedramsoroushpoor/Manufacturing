import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { fa } from '../rm/rm-time';
import { GroupIssue, GroupRow, OptionRow, UsageRow } from './frm-pe-03.data';

interface GroupApiRow {
  GroupId: number;
  Code: string;
  Title: string;
  IsCombinable: boolean;
  IsActive: boolean;
  Description: string | null;
  SubstituteOptionCount: number;
  StructureCount: number;
  DuplicatePriorities: number;
  OriginalItems: string | null;
}
interface OptionApiRow {
  GroupCode: string;
  OptionId: number;
  OptionNo: number;
  OptionTitle: string | null;
  Priority: number | null;
  ProductCode: string;
  ProductTitle: string;
  UnitTitle: string;
  Quantity: number;
  HasRole: boolean;
  OptionDescription: string | null;
}
interface UsageApiRow {
  GroupCode: string;
  StructureCode: string;
  StructureTitle: string;
  RevisionCode: string | null;
  IsCurrentRevision: boolean;
  Sequence: number;
  ProductCode: string;
  ProductTitle: string;
  IsConsistent: boolean;
}
interface BundleApi {
  groups: GroupApiRow[];
  options: OptionApiRow[];
  usage: UsageApiRow[];
}

export interface FrmPe03Bundle {
  groups: GroupRow[];
  options: OptionRow[];
  usage: UsageRow[];
  issues: GroupIssue[];
}

/**
 * داده‌ی واقعی FRM-PE-03 را از gng-mfr-api می‌گیرد (SP های اسکیمای mes — به
 * scripts/mes_frm_pe03_setup.sql نگاه کنید).
 */
@Injectable({ providedIn: 'root' })
export class FrmPe03Service {
  constructor(private http: HttpClient) {}

  load(groupId: number | null, companyId = DEMO_COMPANY_ID): Observable<FrmPe03Bundle> {
    const params: Record<string, number> = { companyId };
    if (groupId !== null) params['groupId'] = groupId;
    return this.http.get<BundleApi>(`${API_BASE_URL}/api/pe03/bundle`, { params }).pipe(map((b) => this.build(b, groupId)));
  }

  private build(b: BundleApi, groupId: number | null): FrmPe03Bundle {
    const options = new Map<number, OptionRow>();
    for (const o of b.options) {
      if (!options.has(o.OptionId)) {
        options.set(o.OptionId, {
          groupCode: o.GroupCode,
          optionNo: o.OptionNo,
          title: o.OptionTitle ?? (o.OptionNo === 0 ? 'اصلی' : `گزینه‌ی ${fa(o.OptionNo)}`),
          priority: o.Priority,
          items: [],
          summary: '',
          description: o.OptionDescription ?? '',
        });
      }
      const opt = options.get(o.OptionId)!;
      opt.items.push({ product: `${o.ProductCode} — ${o.ProductTitle}`, quantity: `${fa(o.Quantity)} ${o.UnitTitle}`, hasRole: o.HasRole });
      opt.summary = opt.items.map((i) => `${i.quantity} ${i.product.split(' — ')[1]}`).join(' + ');
    }

    const groups: GroupRow[] = b.groups.map((g) => ({
      id: g.GroupId,
      code: g.Code,
      title: g.Title,
      combinable: g.IsCombinable,
      active: g.IsActive,
      description: g.Description ?? '',
      optionCount: g.SubstituteOptionCount,
      structureCount: g.StructureCount,
      duplicatePriorities: g.DuplicatePriorities,
      originals: g.OriginalItems ?? '—',
    }));

    const issues: GroupIssue[] = [];
    const inScope = groups.filter((g) => groupId === null || g.id === groupId);
    for (const u of b.usage.filter((x) => !x.IsConsistent)) {
      issues.push({ tone: 'danger', text: `${u.StructureCode} ردیف ${fa(u.Sequence)} (${u.ProductTitle}) به ${u.GroupCode} وصل است ولی این کالا در اقلام اصلی گروه نیست` });
    }
    for (const g of inScope.filter((x) => x.duplicatePriorities)) {
      issues.push({ tone: 'warning', text: `${g.code}: دو گزینه‌ی جایگزین اولویت یکسان دارند` });
    }
    for (const o of [...options.values()].filter((x) => x.items.some((i) => !i.hasRole))) {
      issues.push({ tone: 'warning', text: `${o.groupCode} گزینه‌ی «${o.title}»: کالایی دارد که نقش تولیدی ندارد (FRM-PE-01)` });
    }
    for (const g of inScope.filter((x) => !x.structureCount)) {
      issues.push({ tone: 'info', text: `${g.code} در هیچ ساختاری استفاده نشده` });
    }

    return {
      groups,
      options: [...options.values()],
      usage: b.usage.map((u) => ({
        groupCode: u.GroupCode,
        structure: `${u.StructureCode} — ${u.StructureTitle}`,
        revision: u.RevisionCode ?? '—',
        isCurrent: u.IsCurrentRevision,
        item: `ردیف ${fa(u.Sequence)}: ${u.ProductCode} — ${u.ProductTitle}`,
        consistent: u.IsConsistent,
      })),
      issues,
    };
  }
}
