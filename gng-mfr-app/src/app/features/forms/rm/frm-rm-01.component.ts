import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EMPTY, Subject, Subscription, catchError, switchMap, tap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TreeModule } from 'primeng/tree';
import { TreeNode } from 'primeng/api';
import { OperationalFormLayoutComponent } from '../../../shared/operational-form-layout/operational-form-layout.component';
import { DataSourceBadgeComponent, DataSourceInfo } from '../../../shared/data-source-badge/data-source-badge.component';
import { TopologyGraphComponent } from '../../../shared/topology-graph/topology-graph.component';
import {
  LINE_SIDE_WAREHOUSES,
  LINE_STATIONS,
  MOBILE_RESOURCES,
  MOCK_LINE_TOPOLOGIES,
  ORG_HIERARCHY_TREE,
  ORG_LEVELS,
  RESOURCE_GROUPS,
  LineSideWarehouseRow,
  LineTopology,
  MobileResourceRow,
  OrgLevelRow,
  ResourceGroupRow,
  StationRow,
} from './frm-rm-01.data';
import { FrmRm01Service } from './frm-rm-01.service';
import { DEMO_COMPANY_ID, RmSelection, findTreeNode } from './rm-scope';

/**
 * FRM-RM-01 — «ساختار کارخانه و خطوط تولید» — فرم مرجعِ الگوی «فرم عملیاتی
 * کامل»، بر پایه‌ی OperationalFormLayoutComponent مشترک ساخته شده تا همین
 * الگو با حداقل تکرار روی بقیه‌ی فرم‌ها اعمال شود.
 *
 * درخت «سلسله‌مراتب سازمانی و مکانی» انتخابگر مشترک کل فرم است: هر گره‌ای که
 * در آن انتخاب شود (مجموعه، هلدینگ، شرکت، کارخانه، سالن، خط یا ایستگاه)
 * دامنه‌ی تب‌های «سلسله‌مراتب سازمانی»، «خط تولید و توپولوژی» و «ایستگاه
 * کاری» را تعیین می‌کند. با انتخاب یک گره‌ی سازمانی، توپولوژی همه‌ی خطوط زیر
 * آن — هر خط یک ردیف — نمایش داده می‌شود.
 *
 * اگر API/دیتابیس در لحظه در دسترس نباشد (مثلاً نشست لاگین باز نیست)، فرم به
 * داده‌ی Mock برمی‌گردد تا هیچ‌وقت خالی یا خراب دیده نشود.
 */
@Component({
  selector: 'gng-frm-rm-01',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TabViewModule,
    TableModule,
    TagModule,
    TreeModule,
    OperationalFormLayoutComponent,
    DataSourceBadgeComponent,
    TopologyGraphComponent,
  ],
  templateUrl: './frm-rm-01.component.html',
})
export class FrmRm01Component implements OnInit, OnDestroy {
  orgTree: TreeNode<RmSelection>[] = ORG_HIERARCHY_TREE;
  lineTopologies: LineTopology[] = MOCK_LINE_TOPOLOGIES;
  stations: StationRow[] = LINE_STATIONS;
  resourceGroups: ResourceGroupRow[] = RESOURCE_GROUPS;
  mobileResources: MobileResourceRow[] = MOBILE_RESOURCES;
  lineSideWarehouses: LineSideWarehouseRow[] = LINE_SIDE_WAREHOUSES;
  orgLevels: OrgLevelRow[] = ORG_LEVELS;

  /** گره‌ی انتخاب‌شده در درخت (برای p-tree) و همان انتخاب به شکل دامنه. */
  selectedTreeNode: TreeNode<RmSelection> | null = null;
  selection: RmSelection | null = null;
  /** ایستگاهی که در نمودار و جدول برجسته می‌شود. */
  selectedStationId: number | null = null;

  readonly companyId = DEMO_COMPANY_ID;

  /** true فقط وقتی داده‌ی واقعی با موفقیت نشست؛ برای یک نشانه‌ی کوچک و
   *  غیرتهاجمی روی فرم که نشان بدهد این دیگر Mock نیست. */
  isLiveData = false;
  scopeLoading = false;

  private readonly selection$ = new Subject<RmSelection>();
  private readonly sub = new Subscription();

  constructor(private rm01: FrmRm01Service) {}

  ngOnInit(): void {
    // switchMap: اگر کاربر پشت‌سرهم چند گره را انتخاب کند فقط پاسخ آخرین انتخاب اعمال می‌شود.
    this.sub.add(
      this.selection$
        .pipe(
          tap(() => (this.scopeLoading = true)),
          switchMap((sel) =>
            this.rm01.loadScope(sel).pipe(
              catchError((err) => {
                console.warn('[FRM-RM-01] خواندن دامنه‌ی انتخاب ناموفق بود:', err?.message || err);
                this.scopeLoading = false;
                return EMPTY;
              })
            )
          )
        )
        .subscribe((scope) => {
          this.lineTopologies = scope.lines;
          this.stations = scope.stations;
          this.orgLevels = scope.orgLevels;
          this.attachStationLeaves(scope.lines);
          this.scopeLoading = false;
        })
    );

    this.rm01.loadBase().subscribe({
      next: (base) => {
        if (!base.orgTree.length) return; // شرکت بدون ساختار — همان Mock بماند.
        this.orgTree = base.orgTree;
        this.resourceGroups = base.resourceGroups;
        this.mobileResources = base.mobileResources;
        this.lineSideWarehouses = base.lineSideWarehouses;
        this.isLiveData = true;
        // انتخاب پیش‌فرض: ریشه‌ی درخت، یعنی همه‌ی خطوط کل مجموعه.
        const root = base.orgTree[0];
        this.selectedTreeNode = root;
        this.select(root.data!);
      },
      error: (err) => {
        // بدون نشست لاگین باز، یا اگر scripts/mes_frm_rm01_setup.sql هنوز
        // اجرا نشده، همین رخ می‌دهد — فرم با Mock قبلی کار می‌کند.
        console.warn('[FRM-RM-01] خواندن داده‌ی واقعی ناموفق بود، نمایش داده‌ی Mock:', err?.message || err);
        this.isLiveData = false;
      },
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  // ---- انتخاب در درخت ----

  onTreeSelect(event: { node: TreeNode<RmSelection> }): void {
    if (!this.isLiveData || !event.node?.data) return;
    this.select(event.node.data);
  }

  /** کلیک دوباره روی گره‌ی انتخاب‌شده نباید فرم را بدون دامنه بگذارد. */
  onTreeUnselect(event: { node: TreeNode<RmSelection> }): void {
    setTimeout(() => (this.selectedTreeNode = event.node));
  }

  /** کلیک روی یک ایستگاه در نمودار فقط آن را برجسته می‌کند؛ دامنه عوض نمی‌شود. */
  onGraphNodeClick(stationId: number): void {
    this.selectedStationId = this.selectedStationId === stationId ? null : stationId;
  }

  private select(sel: RmSelection): void {
    this.selection = sel;
    this.selectedStationId = sel.kind === 'station' ? sel.id : null;
    this.selection$.next(sel);
  }

  /** ایستگاه‌های خطوطِ تازه‌خوانده‌شده را به‌عنوان برگ زیر همان خط در درخت می‌گذارد. */
  private attachStationLeaves(lines: LineTopology[]): void {
    let changed = false;
    for (const line of lines) {
      const node = findTreeNode(this.orgTree, `line-${line.lineId}`);
      if (!node) continue;
      if (!node.children?.length) {
        const leaves = this.rm01.stationLeaves(line);
        if (!leaves.length) continue;
        node.children = leaves;
        changed = true;
      }
      // فقط خطی که خودش انتخاب شده باز می‌شود؛ با انتخاب یک گره‌ی بالادست
      // (که ممکن است ده‌ها خط داشته باشد) درخت شلوغ نمی‌شود.
      if (lines.length === 1 && !node.expanded) {
        node.expanded = true;
        changed = true;
      }
    }
    if (changed) this.orgTree = [...this.orgTree];
  }

  // ---- متن‌ها و کمک‌تابع‌های قالب ----

  get contextLabel(): string {
    return this.selection?.title ?? 'خط قرص‌سازی ۲ — L2-TABLET';
  }

  get topologyTitle(): string {
    if (!this.selection) return 'توپولوژی خط قرص‌سازی ۲';
    if (this.selection.kind === 'org') return `توپولوژی خطوط «${this.selection.title}»`;
    return `توپولوژی ${this.lineTopologies[0]?.title ?? this.selection.title}`;
  }

  get showLineColumn(): boolean {
    return this.lineTopologies.length > 1;
  }

  fa(n: number): string {
    return n.toLocaleString('fa-IR');
  }

  stationCount(line: LineTopology): number {
    return line.nodes.filter((n) => n.kind !== 'buffer').length;
  }

  trackLine(_: number, line: LineTopology): number {
    return line.lineId;
  }

  levelSeverity(status: string): 'success' | 'danger' {
    return status === 'فعال' ? 'success' : 'danger';
  }

  stationStatusSeverity(status: string): 'success' | 'danger' {
    return status === 'فعال' ? 'success' : 'danger';
  }

  // ---- منبع داده‌ی زنده‌ی هر گرید (دکمه‌ی سه‌نقطه‌ی گوشه) — استاندارد کل سیستم ----

  /** اگر دقیقاً یک خط در دامنه باشد، نمونه‌ی خام همان خط فیلتر می‌شود. */
  private get singleLineId(): number | undefined {
    return this.isLiveData && this.lineTopologies.length === 1 ? this.lineTopologies[0].lineId : undefined;
  }

  orgTreeSource(): DataSourceInfo {
    return { key: 'rm01-org-tree', label: 'درخت سازمانی', filterVal: this.companyId };
  }
  orgLevelsSource(): DataSourceInfo {
    return { key: 'rm01-node-ancestry', label: 'سلسله‌مراتب سازمانی', filterVal: this.companyId };
  }
  topologySource(): DataSourceInfo {
    return { key: 'rm01-links', label: 'اتصال ایستگاه‌ها (توپولوژی)', filterVal: this.singleLineId };
  }
  stationsSource(): DataSourceInfo {
    return { key: 'rm01-topology', label: 'ایستگاه کاری', filterVal: this.singleLineId };
  }
  resourceGroupsSource(): DataSourceInfo {
    return { key: 'rm01-resource-groups', label: 'گروه منبع', filterVal: this.companyId };
  }
  mobileResourcesSource(): DataSourceInfo {
    return { key: 'rm01-mobile-resources', label: 'منبع سیار', filterVal: this.companyId };
  }
  lineSideWarehousesSource(): DataSourceInfo {
    return { key: 'rm01-warehouses', label: 'انبار پای کار', filterVal: this.companyId };
  }
}
