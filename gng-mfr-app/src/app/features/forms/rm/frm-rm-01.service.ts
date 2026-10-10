import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map } from 'rxjs';
import { TreeNode } from 'primeng/api';
import { API_BASE_URL } from '../../../core/api-config';
import { GraphEdgeKind, GraphNodeKind } from '../../../shared/topology-graph/topology-graph.component';
import {
  LineSideWarehouseRow,
  LineTopology,
  MobileResourceRow,
  OrgLevelRow,
  ResourceGroupRow,
  StationRow,
} from './frm-rm-01.data';
import {
  DEMO_COMPANY_ID,
  LEVEL_LABELS,
  OrgNodeRow,
  ProductionLineRow,
  RmSelection,
  buildOrgTree,
  stationLeaves,
} from './rm-scope';

// نوع انتخاب و شناسه‌ی شرکت نمایشی حالا در rm-scope.ts (مشترک بین فرم‌ها) است.
export { DEMO_COMPANY_ID } from './rm-scope';
export type { RmSelection } from './rm-scope';

const BASE = `${API_BASE_URL}/api/rm01`;

interface AncestryRow {
  LevelCode: string;
  Title: string;
  OwnerTitle: string | null;
  BackupTitle: string | null;
  IsActive: boolean;
  Depth: number;
}

interface StationApiRow {
  StationId: number;
  LineId: number;
  Code: string;
  Title: string;
  Sublabel: string | null;
  StationType: string;
  TopologyType: GraphNodeKind;
  CostCenterCode: string | null;
  ResourceGroupCode: string | null;
  ResourceGroupTitle: string | null;
  SharePercentText: string | null;
  LineSideWarehouseCode: string | null;
  LineSideWarehouseTitle: string | null;
  SequenceNo: number;
  IsActive: boolean;
}

interface LinkApiRow {
  LinkId: number;
  LineId: number;
  FromStationId: number;
  ToStationId: number;
  LinkType: GraphEdgeKind;
  Note: string | null;
  IsActive: boolean;
}

interface TopologyApiLine extends ProductionLineRow {
  nodes: StationApiRow[];
  edges: LinkApiRow[];
}

interface ResourceGroupApiRow {
  ResourceGroupId: number;
  Code: string;
  Title: string;
  DispatchRule: string | null;
  Members: string | null;
}

interface MobileResourceApiRow {
  MobileResourceId: number;
  Code: string;
  Title: string;
  CurrentSiteTitle: string | null;
  Capability: string | null;
}

interface LineSideWarehouseApiRow {
  WarehouseId: number;
  Code: string;
  Title: string;
  ReferenceWarehouseCode: string | null;
  LinkedStationCodes: string | null;
}

/** داده‌ای که یک‌بار برای کل فرم خوانده می‌شود و با تغییر انتخاب عوض نمی‌شود. */
export interface FrmRm01Base {
  /** درخت سازمانی تا سطح خط. برگ‌های ایستگاه بعد از خواندن هر دامنه اضافه می‌شوند. */
  orgTree: TreeNode<RmSelection>[];
  resourceGroups: ResourceGroupRow[];
  mobileResources: MobileResourceRow[];
  lineSideWarehouses: LineSideWarehouseRow[];
}

/** داده‌ی وابسته به گره‌ی انتخاب‌شده در درخت. */
export interface FrmRm01Scope {
  lines: LineTopology[];
  stations: StationRow[];
  orgLevels: OrgLevelRow[];
}

/**
 * داده‌ی واقعی FRM-RM-01 را از gng-mfr-api (که از SP های اسکیمای mes
 * می‌خواند — به scripts/mes_frm_rm01_setup.sql نگاه کنید) می‌گیرد.
 */
@Injectable({ providedIn: 'root' })
export class FrmRm01Service {
  constructor(private http: HttpClient) {}

  loadBase(companyId: number = DEMO_COMPANY_ID): Observable<FrmRm01Base> {
    return forkJoin({
      orgNodes: this.http.get<OrgNodeRow[]>(`${BASE}/org-tree`, { params: { companyId } }),
      lines: this.http.get<ProductionLineRow[]>(`${BASE}/lines`, { params: { companyId } }),
      resourceGroups: this.http.get<ResourceGroupApiRow[]>(`${BASE}/resource-groups`, { params: { companyId } }),
      mobileResources: this.http.get<MobileResourceApiRow[]>(`${BASE}/mobile-resources`, { params: { companyId } }),
      lineSideWarehouses: this.http.get<LineSideWarehouseApiRow[]>(`${BASE}/line-side-warehouses`, { params: { companyId } }),
    }).pipe(
      map(({ orgNodes, lines, resourceGroups, mobileResources, lineSideWarehouses }) => ({
        orgTree: buildOrgTree(orgNodes, lines),
        resourceGroups: this.buildResourceGroups(resourceGroups),
        mobileResources: this.buildMobileResources(mobileResources),
        lineSideWarehouses: this.buildLineSideWarehouses(lineSideWarehouses),
      }))
    );
  }

  loadScope(selection: RmSelection): Observable<FrmRm01Scope> {
    const lineId = selection.kind === 'line' ? selection.id : selection.kind === 'station' ? selection.lineId : null;
    const params: Record<string, number> = lineId !== null ? { lineId } : { orgNodeId: selection.id };
    const ancestryUrl =
      lineId !== null ? `${BASE}/lines/${lineId}/ancestry` : `${BASE}/org-nodes/${selection.id}/ancestry`;

    return forkJoin({
      topology: this.http.get<{ lines: TopologyApiLine[] }>(`${BASE}/topology`, { params }),
      ancestry: this.http.get<AncestryRow[]>(ancestryUrl),
    }).pipe(
      map(({ topology, ancestry }) => ({
        lines: topology.lines.map((l) => this.buildLineTopology(l)),
        stations: topology.lines.flatMap((l) => this.buildStations(l)),
        orgLevels: this.buildOrgLevels(ancestry),
      }))
    );
  }

  /** برگ‌های ایستگاهِ یک خط برای درخت (بافرها ایستگاه کاری نیستند و نمی‌آیند). */
  stationLeaves(line: LineTopology): TreeNode<RmSelection>[] {
    return stationLeaves(
      line.lineId,
      line.title,
      line.nodes.map((n) => ({ StationId: n.id, LineId: line.lineId, Code: n.code, Title: n.label, TopologyType: n.kind }))
    );
  }

  // ---- نگاشت‌ها: از شکل خام API به همان اینترفیس‌هایی که HTML مصرف می‌کند ----

  private buildOrgLevels(ancestry: AncestryRow[]): OrgLevelRow[] {
    return ancestry.map((row) => ({
      level: LEVEL_LABELS[row.LevelCode] ?? row.LevelCode,
      title: row.Title,
      owner: row.OwnerTitle ?? '—',
      backup: row.BackupTitle ?? '—',
      status: row.IsActive ? 'فعال' : 'غیرفعال',
    }));
  }

  private buildLineTopology(l: TopologyApiLine): LineTopology {
    return {
      lineId: l.LineId,
      code: l.Code,
      title: l.Title,
      unitTitle: l.UnitTitle,
      active: l.IsActive,
      nodes: l.nodes.map((s) => ({
        id: s.StationId,
        code: s.Code,
        label: s.Title,
        sublabel: s.Sublabel ?? '',
        kind: s.TopologyType,
        active: s.IsActive,
        seq: s.SequenceNo,
      })),
      edges: l.edges.map((k) => ({
        from: k.FromStationId,
        to: k.ToStationId,
        kind: k.LinkType,
        active: k.IsActive,
        note: k.Note ?? undefined,
      })),
    };
  }

  private buildStations(l: TopologyApiLine): StationRow[] {
    return l.nodes
      .filter((r) => r.TopologyType !== 'buffer')
      .map((r) => ({
        id: r.StationId,
        lineId: l.LineId,
        lineTitle: l.Title,
        code: r.Code,
        title: r.Title,
        type: r.StationType,
        costCenter: r.CostCenterCode ?? '—',
        resourceGroup: r.ResourceGroupCode ?? '—',
        sharePercent: r.SharePercentText ?? '—',
        lineSideWarehouse: r.LineSideWarehouseCode ?? '—',
        status: r.IsActive ? 'فعال' : 'غیرفعال از تاریخ اثر',
      }));
  }

  private buildResourceGroups(rows: ResourceGroupApiRow[]): ResourceGroupRow[] {
    return rows.map((r) => ({
      code: r.Code,
      title: r.Title,
      members: r.Members ?? '—',
      dispatchRule: r.DispatchRule ?? '—',
    }));
  }

  private buildMobileResources(rows: MobileResourceApiRow[]): MobileResourceRow[] {
    return rows.map((r) => ({
      code: r.Code,
      title: r.Title,
      currentSite: r.CurrentSiteTitle ?? '—',
      capability: r.Capability ?? '—',
    }));
  }

  private buildLineSideWarehouses(rows: LineSideWarehouseApiRow[]): LineSideWarehouseRow[] {
    return rows.map((r) => ({
      code: r.Code,
      title: r.Title,
      linkedStation: r.LinkedStationCodes ?? '—',
      referenceWarehouse: r.ReferenceWarehouseCode ?? '—',
    }));
  }
}
