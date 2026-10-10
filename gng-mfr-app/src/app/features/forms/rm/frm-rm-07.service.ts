import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { TreeNode } from 'primeng/api';
import { API_BASE_URL } from '../../../core/api-config';
import {
  AllowedCell,
  CATEGORIES,
  CATEGORY_LABEL,
  DEVIATION_TYPE_LABEL,
  LEVEL_LABEL,
  OEE_COMPONENT_LABEL,
  OeeLossRow,
  OeeStatus,
  ReasonCategory,
  ReasonNodeRow,
  ReasonRef,
  RuleRow,
  STOPPAGE_TYPE_LABEL,
  StationAllowedRow,
  WASTE_TYPE_LABEL,
} from './frm-rm-07.data';
import { RmSelection, scopeQuery } from './rm-scope';

interface TreeApiRow {
  CategoryCode: ReasonCategory;
  NodeKey: string;
  ParentKey: string | null;
  Number: string | null;
  Name: string;
  IsGroup: boolean;
  IsActive: boolean;
  ProblemTypeCode: number | null;
  OeeLossCode: number | null;
  OeeLossTitle: string | null;
  OeeComponentCode: number | null;
  IsExcludedFromOee: boolean | null;
  WasteTypeCode: number | null;
  DeviationTypeCode: number | null;
  Description: string | null;
  RuleCount: number;
  IsUnmapped: boolean;
}
interface OeeApiRow {
  MappingStatus: 'mapped' | 'excluded' | 'unmapped';
  LossCode: number | null;
  LossTitle: string | null;
  LossEnglishTitle: string | null;
  OeeComponentCode: number | null;
  CategoryCode: ReasonCategory | null;
  NodeKey: string | null;
  ReasonNumber: string | null;
  ReasonTitle: string | null;
  ParentTitle: string | null;
  ProblemTypeCode: number | null;
}
interface RuleApiRow {
  ReasonCategoryCode: ReasonCategory;
  ReasonNumber: string | null;
  ReasonTitle: string;
  IsGroup: boolean;
  LevelCode: string;
  TargetTitle: string;
  Description: string | null;
  LeafCount: number;
}
interface AllowedApiRow {
  StationId: number;
  StationCode: string;
  StationTitle: string;
  LineId: number;
  LineTitle: string;
  CategoryCode: ReasonCategory;
  SourceLevel: string;
  SourceTitle: string | null;
  NodeKey: string;
}
interface BundleApi {
  tree: TreeApiRow[];
  oee: OeeApiRow[];
  restrictions: RuleApiRow[];
  allowed: AllowedApiRow[];
}

/** همه‌ی داده‌ی فرم برای یک دامنه‌ی انتخاب. */
export interface FrmRm07Bundle {
  trees: Record<ReasonCategory, TreeNode<ReasonNodeRow>[]>;
  leafTotals: Record<ReasonCategory, number>;
  losses: OeeLossRow[];
  excluded: ReasonRef[];
  unmapped: ReasonRef[];
  rules: RuleRow[];
  stations: StationAllowedRow[];
}

const codeTitle = (code: string | null, title: string) => (code ? `${code} — ${title}` : title);

/**
 * داده‌ی واقعی FRM-RM-07 را از gng-mfr-api می‌گیرد (SP های اسکیمای mes — به
 * scripts/mes_frm_rm07_setup.sql نگاه کنید).
 */
@Injectable({ providedIn: 'root' })
export class FrmRm07Service {
  constructor(private http: HttpClient) {}

  loadScope(selection: RmSelection): Observable<FrmRm07Bundle> {
    const stationId = selection.kind === 'station' ? selection.id : null;
    return this.http
      .get<BundleApi>(`${API_BASE_URL}/api/rm07/bundle`, { params: scopeQuery(selection) })
      .pipe(map((b) => this.build(b, stationId)));
  }

  private build(b: BundleApi, stationId: number | null): FrmRm07Bundle {
    const allowedKeys = stationId === null ? null : new Set(b.allowed.filter((a) => a.StationId === stationId).map((a) => a.NodeKey));
    const leafTotals = { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<ReasonCategory, number>;
    for (const r of b.tree) if (!r.IsGroup && r.IsActive) leafTotals[r.CategoryCode]++;

    return {
      trees: {
        1: this.buildTree(b.tree, 1, allowedKeys),
        2: this.buildTree(b.tree, 2, allowedKeys),
        3: this.buildTree(b.tree, 3, allowedKeys),
        4: this.buildTree(b.tree, 4, allowedKeys),
      },
      leafTotals,
      ...this.buildOee(b.oee),
      rules: b.restrictions.map((r) => ({
        level: LEVEL_LABEL[r.LevelCode] ?? r.LevelCode,
        levelCode: r.LevelCode,
        target: r.TargetTitle,
        category: CATEGORY_LABEL[r.ReasonCategoryCode],
        reason: codeTitle(r.ReasonNumber, r.ReasonTitle),
        isGroup: r.IsGroup,
        leafCount: r.LeafCount,
        description: r.Description ?? '—',
      })),
      stations: this.buildStations(b.allowed, leafTotals),
    };
  }

  private buildTree(rows: TreeApiRow[], category: ReasonCategory, allowedKeys: Set<string> | null): TreeNode<ReasonNodeRow>[] {
    const own = rows.filter((r) => r.CategoryCode === category);
    const nodes = new Map<string, TreeNode<ReasonNodeRow>>();
    for (const r of own) {
      let oeeStatus: OeeStatus = 'none';
      if (!r.IsGroup && (category === 1 || (category === 2 && r.WasteTypeCode === 2))) {
        oeeStatus = r.OeeLossCode ? 'mapped' : r.IsExcludedFromOee ? 'excluded' : 'unmapped';
      } else if (!r.IsGroup && r.OeeLossCode) {
        oeeStatus = 'mapped';
      }
      const typeLabel =
        category === 1 && !r.IsGroup
          ? STOPPAGE_TYPE_LABEL[r.ProblemTypeCode ?? 0] ?? '—'
          : category === 2
            ? WASTE_TYPE_LABEL[r.WasteTypeCode ?? 0] ?? '—'
            : category === 4
              ? DEVIATION_TYPE_LABEL[r.DeviationTypeCode ?? 0] ?? '—'
              : '';
      nodes.set(r.NodeKey, {
        key: r.NodeKey,
        expanded: true,
        data: {
          key: r.NodeKey,
          code: r.Number ?? '',
          title: r.Name,
          isGroup: r.IsGroup,
          active: r.IsActive,
          typeLabel,
          oeeStatus,
          oeeLabel: oeeStatus === 'mapped' ? r.OeeLossTitle ?? '' : oeeStatus === 'excluded' ? 'خارج از OEE' : oeeStatus === 'unmapped' ? 'نگاشت‌نشده' : '',
          oeeComponent: r.OeeComponentCode ? OEE_COMPONENT_LABEL[r.OeeComponentCode] : '',
          ruleCount: r.RuleCount,
          description: r.Description ?? '',
          leafCount: 0,
          allowedCount: null,
        },
        children: [],
      });
    }
    const roots: TreeNode<ReasonNodeRow>[] = [];
    for (const r of own) {
      const node = nodes.get(r.NodeKey)!;
      const parent = r.ParentKey ? nodes.get(r.ParentKey) : undefined;
      (parent ? parent.children! : roots).push(node);
    }
    /* شمار علل فعال و مجاز زیر هر گره، از برگ به بالا */
    const count = (n: TreeNode<ReasonNodeRow>): void => {
      const d = n.data!;
      if (!d.isGroup) {
        d.leafCount = d.active ? 1 : 0;
        d.allowedCount = allowedKeys ? (d.active && allowedKeys.has(d.key) ? 1 : 0) : null;
        return;
      }
      n.children!.forEach(count);
      d.leafCount = n.children!.reduce((s, c) => s + c.data!.leafCount, 0);
      d.allowedCount = allowedKeys ? n.children!.reduce((s, c) => s + (c.data!.allowedCount ?? 0), 0) : null;
    };
    roots.forEach(count);
    return roots;
  }

  private buildOee(rows: OeeApiRow[]): { losses: OeeLossRow[]; excluded: ReasonRef[]; unmapped: ReasonRef[] } {
    const ref = (r: OeeApiRow): ReasonRef => ({
      code: r.ReasonNumber ?? '',
      title: r.ReasonTitle ?? '',
      parent: r.ParentTitle ?? '',
      category: r.CategoryCode ? CATEGORY_LABEL[r.CategoryCode] : '',
      typeLabel: r.CategoryCode === 1 ? STOPPAGE_TYPE_LABEL[r.ProblemTypeCode ?? 0] ?? '' : 'ضایعات محصول',
    });
    const losses = new Map<number, OeeLossRow>();
    for (const r of rows.filter((x) => x.MappingStatus === 'mapped' && x.LossCode !== null)) {
      if (!losses.has(r.LossCode!)) {
        losses.set(r.LossCode!, {
          code: r.LossCode!,
          title: r.LossTitle ?? '',
          englishTitle: r.LossEnglishTitle ?? '',
          component: OEE_COMPONENT_LABEL[r.OeeComponentCode ?? 0] ?? '',
          causes: [],
        });
      }
      if (r.NodeKey) losses.get(r.LossCode!)!.causes.push(ref(r));
    }
    return {
      losses: [...losses.values()],
      excluded: rows.filter((r) => r.MappingStatus === 'excluded').map(ref),
      unmapped: rows.filter((r) => r.MappingStatus === 'unmapped').map(ref),
    };
  }

  private buildStations(rows: AllowedApiRow[], totals: Record<ReasonCategory, number>): StationAllowedRow[] {
    const stations = new Map<number, { row: StationAllowedRow; counts: Map<ReasonCategory, AllowedCell> }>();
    for (const r of rows) {
      if (!stations.has(r.StationId)) {
        stations.set(r.StationId, {
          row: { stationId: r.StationId, station: `${r.StationCode} — ${r.StationTitle}`, line: r.LineTitle, cells: [] },
          counts: new Map(),
        });
      }
      const s = stations.get(r.StationId)!;
      const cell = s.counts.get(r.CategoryCode) ?? {
        allowed: 0,
        total: totals[r.CategoryCode],
        level: LEVEL_LABEL[r.SourceLevel] ?? r.SourceLevel,
        levelCode: r.SourceLevel,
        source: r.SourceTitle ?? '—',
      };
      cell.allowed++;
      s.counts.set(r.CategoryCode, cell);
    }
    return [...stations.values()].map((s) => ({
      ...s.row,
      cells: CATEGORIES.map(
        (c) => s.counts.get(c) ?? { allowed: 0, total: totals[c], level: '—', levelCode: 'empty', source: '—' }
      ),
    }));
  }
}
