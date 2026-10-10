import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { TreeNode } from 'primeng/api';
import { API_BASE_URL } from '../../../core/api-config';

/**
 * «دامنه‌ی انتخاب» مشترک فرم‌های حوزه‌ی مدیریت منابع.
 *
 * قاعده‌ی سیستم: درخت «سلسله‌مراتب سازمانی و مکانی» (سمت راست فرم) انتخابگر
 * مشترک است و هر فرم داده‌اش را به گره‌ی انتخاب‌شده محدود می‌کند:
 *  - org: آن گره‌ی سازمانی با همه‌ی زیرگره‌هایش
 *  - line: فقط همان خط
 *  - station: همان ایستگاه (فرمی که سطح ایستگاه ندارد، خطِ آن را نشان می‌دهد)
 *
 * این فایل نوع انتخاب، ساختن درخت و تبدیل انتخاب به پارامتر API را یک‌جا نگه
 * می‌دارد تا همه‌ی فرم‌ها دقیقاً یک رفتار داشته باشند.
 */
export type RmSelection =
  | { kind: 'org'; id: number; title: string }
  | { kind: 'line'; id: number; title: string }
  | { kind: 'station'; id: number; lineId: number; title: string };

export const DEMO_COMPANY_ID = 222;

export const LEVEL_LABELS: Record<string, string> = {
  Group: 'مجموعه صنعتی',
  Holding: 'هلدینگ',
  Company: 'شرکت',
  Branch: 'شعبه',
  Factory: 'کارخانه',
  Unit: 'واحد تولیدی',
  Line: 'خط',
};

export const LEVEL_ICONS: Record<string, string> = {
  Group: 'pi pi-globe',
  Holding: 'pi pi-briefcase',
  Company: 'pi pi-building',
  Branch: 'pi pi-sitemap',
  Factory: 'pi pi-building',
  Unit: 'pi pi-th-large',
};

export interface OrgNodeRow {
  OrgNodeId: number;
  ParentOrgNodeId: number | null;
  LevelCode: string;
  Title: string;
  OwnerTitle: string | null;
  BackupTitle: string | null;
  IsActive: boolean;
}

export interface ProductionLineRow {
  LineId: number;
  OrgNodeId: number;
  Code: string;
  Title: string;
  IsActive: boolean;
  UnitTitle: string;
}

/** حداقل چیزی که درخت از یک ایستگاه لازم دارد. */
export interface ScopeStation {
  StationId: number;
  LineId: number;
  Code: string;
  Title: string;
  TopologyType: string;
}

/** برگ‌های ایستگاهِ یک خط (بافرها ایستگاه کاری نیستند و در درخت نمی‌آیند). */
export function stationLeaves(lineId: number, lineTitle: string, stations: ScopeStation[]): TreeNode<RmSelection>[] {
  return stations
    .filter((s) => s.LineId === lineId && s.TopologyType !== 'buffer')
    .map((s) => ({
      key: `st-${s.StationId}`,
      label: `${s.Code} — ${s.Title}`,
      icon: 'pi pi-stop',
      data: { kind: 'station', id: s.StationId, lineId, title: `${s.Title} — ${lineTitle}` },
    }));
}

/**
 * درخت سازمانی تا سطح خط؛ اگر stations داده شود ایستگاه‌ها هم زیر هر خط
 * می‌آیند (خط‌ها بسته می‌مانند تا درخت شلوغ نشود).
 */
export function buildOrgTree(
  orgNodes: OrgNodeRow[],
  lines: ProductionLineRow[],
  stations?: ScopeStation[]
): TreeNode<RmSelection>[] {
  const byParent = new Map<number | null, OrgNodeRow[]>();
  for (const n of orgNodes) {
    const key = n.ParentOrgNodeId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(n);
  }
  const linesByUnit = new Map<number, ProductionLineRow[]>();
  for (const l of lines) {
    if (!linesByUnit.has(l.OrgNodeId)) linesByUnit.set(l.OrgNodeId, []);
    linesByUnit.get(l.OrgNodeId)!.push(l);
  }

  const buildNode = (n: OrgNodeRow): TreeNode<RmSelection> => {
    const childUnits = (byParent.get(n.OrgNodeId) ?? []).map(buildNode);
    const childLines: TreeNode<RmSelection>[] = (linesByUnit.get(n.OrgNodeId) ?? []).map((l) => ({
      key: `line-${l.LineId}`,
      label: l.Title,
      icon: 'pi pi-directions',
      data: { kind: 'line', id: l.LineId, title: `${l.Title} — ${l.Code}` },
      children: stations ? stationLeaves(l.LineId, l.Title, stations) : undefined,
    }));
    return {
      key: `org-${n.OrgNodeId}`,
      label: n.Title,
      icon: LEVEL_ICONS[n.LevelCode] ?? 'pi pi-circle',
      expanded: true,
      data: { kind: 'org', id: n.OrgNodeId, title: n.Title },
      children: [...childUnits, ...childLines],
    };
  };

  return (byParent.get(null) ?? []).map(buildNode);
}

export function findTreeNode(nodes: TreeNode<RmSelection>[], key: string): TreeNode<RmSelection> | undefined {
  for (const n of nodes) {
    if (n.key === key) return n;
    const hit = n.children ? findTreeNode(n.children, key) : undefined;
    if (hit) return hit;
  }
  return undefined;
}

/** پارامترهای query برای endpointهایی که دامنه را تا سطح ایستگاه می‌فهمند. */
export function scopeQuery(sel: RmSelection): Record<string, number> {
  if (sel.kind === 'org') return { orgNodeId: sel.id };
  if (sel.kind === 'line') return { lineId: sel.id };
  return { lineId: sel.lineId, stationId: sel.id };
}

@Injectable({ providedIn: 'root' })
export class RmScopeService {
  constructor(private http: HttpClient) {}

  /** درخت کامل (سازمان ← خط ← ایستگاه) برای فرم‌هایی که تا سطح ایستگاه فیلتر می‌شوند. */
  loadFullTree(companyId: number = DEMO_COMPANY_ID): Observable<TreeNode<RmSelection>[]> {
    const base = `${API_BASE_URL}/api/rm01`;
    return forkJoin({
      orgNodes: this.http.get<OrgNodeRow[]>(`${base}/org-tree`, { params: { companyId } }),
      lines: this.http.get<ProductionLineRow[]>(`${base}/lines`, { params: { companyId } }),
    }).pipe(
      switchMap(({ orgNodes, lines }) => {
        const roots = orgNodes.filter((n) => n.ParentOrgNodeId === null);
        if (!roots.length) return of(buildOrgTree(orgNodes, lines, []));
        return forkJoin(
          roots.map((r) =>
            this.http.get<{ lines: { nodes: ScopeStation[] }[] }>(`${base}/topology`, { params: { orgNodeId: r.OrgNodeId } })
          )
        ).pipe(
          map((results) => {
            const stations = results.flatMap((res) => res.lines.flatMap((l) => l.nodes));
            return buildOrgTree(orgNodes, lines, stations);
          })
        );
      })
    );
  }
}
