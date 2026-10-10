import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EMPTY, Subject, Subscription, catchError, switchMap, tap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TreeModule } from 'primeng/tree';
import { TreeNode } from 'primeng/api';
import { OperationalFormLayoutComponent, BannerTone } from '../../../shared/operational-form-layout/operational-form-layout.component';
import { DataSourceBadgeComponent, DataSourceInfo } from '../../../shared/data-source-badge/data-source-badge.component';
import {
  AttributeRow,
  CAPABILITIES,
  CHANGEOVER_MATRICES,
  CapabilityRow,
  ChangeoverMatrix,
  EQUIPMENT_LIST,
  EQUIPMENT_TREE,
  EquipmentRow,
  MaintenanceCode,
  SOFTWARE_VERSIONS,
  SoftwareVersionRow,
  TECHNICAL_ATTRIBUTES,
  TOOL_LIFE,
  ToolRow,
} from './frm-rm-02.data';
import { FrmRm02Service, TOOL_REPLACE_PERCENT } from './frm-rm-02.service';
import { DEMO_COMPANY_ID, RmScopeService, RmSelection } from './rm-scope';

const MAINTENANCE_LABEL: Record<MaintenanceCode, string> = {
  available: 'در دسترس',
  repair: 'تحت تعمیر',
  stopped: 'متوقف',
};

/**
 * FRM-RM-02 — «تجهیزات، ابزار و قالب».
 *
 * مثل FRM-RM-01، درخت «سلسله‌مراتب سازمانی و مکانی» (سمت راست) انتخابگر مشترک
 * فرم است: با انتخاب هر گره‌ی سازمانی، خط یا ایستگاه، همه‌ی تب‌ها به تجهیزات
 * همان دامنه محدود می‌شوند.
 *
 * اگر API/دیتابیس در دسترس نباشد، فرم با داده‌ی Mock نمایش داده می‌شود.
 */
@Component({
  selector: 'gng-frm-rm-02',
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
  ],
  templateUrl: './frm-rm-02.component.html',
})
export class FrmRm02Component implements OnInit, OnDestroy {
  orgTree: TreeNode<RmSelection>[] = EQUIPMENT_TREE;
  equipmentList: EquipmentRow[] = EQUIPMENT_LIST;
  attributes: AttributeRow[] = TECHNICAL_ATTRIBUTES;
  capabilities: CapabilityRow[] = CAPABILITIES;
  toolLife: ToolRow[] = TOOL_LIFE;
  changeover: ChangeoverMatrix[] = CHANGEOVER_MATRICES;
  softwareVersions: SoftwareVersionRow[] = SOFTWARE_VERSIONS;

  selectedTreeNode: TreeNode<RmSelection> | null = null;
  selection: RmSelection | null = null;

  readonly companyId = DEMO_COMPANY_ID;
  isLiveData = false;
  scopeLoading = false;

  private readonly selection$ = new Subject<RmSelection>();
  private readonly sub = new Subscription();

  constructor(
    private scope: RmScopeService,
    private rm02: FrmRm02Service
  ) {}

  ngOnInit(): void {
    // switchMap: اگر کاربر پشت‌سرهم چند گره را انتخاب کند فقط پاسخ آخرین انتخاب اعمال می‌شود.
    this.sub.add(
      this.selection$
        .pipe(
          tap(() => (this.scopeLoading = true)),
          switchMap((sel) =>
            this.rm02.loadScope(sel).pipe(
              catchError((err) => {
                console.warn('[FRM-RM-02] خواندن دامنه‌ی انتخاب ناموفق بود:', err?.message || err);
                this.scopeLoading = false;
                return EMPTY;
              })
            )
          )
        )
        .subscribe((b) => {
          this.equipmentList = b.equipment;
          this.attributes = b.attributes;
          this.capabilities = b.capabilities;
          this.toolLife = b.tools;
          this.changeover = b.changeover;
          this.softwareVersions = b.software;
          this.isLiveData = true;
          this.scopeLoading = false;
        })
    );

    this.scope.loadFullTree(this.companyId).subscribe({
      next: (tree) => {
        if (!tree.length) return; // شرکت بدون ساختار — همان Mock بماند.
        this.orgTree = tree;
        // انتخاب پیش‌فرض: ریشه‌ی درخت، یعنی همه‌ی تجهیزات کل مجموعه.
        this.selectedTreeNode = tree[0];
        this.select(tree[0].data!);
      },
      error: (err) => {
        console.warn('[FRM-RM-02] خواندن داده‌ی واقعی ناموفق بود، نمایش داده‌ی Mock:', err?.message || err);
      },
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  // ---- انتخاب در درخت ----

  onTreeSelect(event: { node: TreeNode<RmSelection> }): void {
    if (!event.node?.data) return;
    this.select(event.node.data);
  }

  /** کلیک دوباره روی گره‌ی انتخاب‌شده نباید فرم را بدون دامنه بگذارد. */
  onTreeUnselect(event: { node: TreeNode<RmSelection> }): void {
    setTimeout(() => (this.selectedTreeNode = event.node));
  }

  private select(sel: RmSelection): void {
    this.selection = sel;
    this.selection$.next(sel);
  }

  // ---- متن‌ها و کمک‌تابع‌های قالب ----

  get contextLabel(): string {
    return this.selection?.title ?? 'خط قرص‌سازی ۲ — L2-TABLET';
  }

  /** ابزارهایی که به آستانه‌ی تعویض رسیده‌اند. */
  private get wornTools(): ToolRow[] {
    return this.toolLife.filter((t) => t.lifePercent >= TOOL_REPLACE_PERCENT);
  }

  private get unavailable(): EquipmentRow[] {
    return this.equipmentList.filter((e) => e.maintenance !== 'available');
  }

  /** بنر بالای فرم از روی وضعیت واقعی دامنه ساخته می‌شود: اول ابزار نزدیک پایان عمر، بعد تجهیز خارج از دسترس. */
  get bannerTone(): BannerTone {
    if (!this.equipmentList.length && !this.toolLife.length) return 'info';
    if (this.wornTools.length) return 'danger';
    if (this.unavailable.length) return 'warning';
    return 'success';
  }

  get bannerText(): string {
    if (!this.equipmentList.length && !this.toolLife.length) {
      return `در «${this.contextLabel}» هنوز تجهیز یا ابزاری تعریف نشده است.`;
    }
    const worn = this.wornTools;
    if (worn.length) {
      const list = worn.map((t) => `${t.code} (${t.title}) — ${this.fa(t.lifePercent)}٪`).join('، ');
      return `ابزار نزدیک پایان عمر مفید: ${list}. پیش از دستور بعدی نیازمند تعویض است.`;
    }
    const down = this.unavailable;
    if (down.length) {
      const list = down.map((e) => `${e.code} (${this.maintenanceLabel(e.maintenance)})`).join('، ');
      return `تجهیز خارج از دسترس طبق سیستم نت: ${list}.`;
    }
    return 'در این دامنه همه‌ی تجهیزات در دسترس و همه‌ی ابزارها در محدوده‌ی عمر مجازند.';
  }

  fa(n: number): string {
    return n.toLocaleString('fa-IR');
  }

  maintenanceLabel(code: MaintenanceCode): string {
    return MAINTENANCE_LABEL[code];
  }

  maintenanceSeverity(code: MaintenanceCode): 'success' | 'warning' | 'danger' {
    return code === 'available' ? 'success' : code === 'repair' ? 'warning' : 'danger';
  }

  barFillClass(severity: string): string {
    if (severity === 'warning') return 'gng-kpi__bar-fill--warning';
    if (severity === 'danger') return 'gng-kpi__bar-fill--danger';
    if (severity === 'info') return 'gng-kpi__bar-fill--info';
    return '';
  }

  trackMatrix(_: number, m: ChangeoverMatrix): string {
    return m.equipment;
  }

  // ---- منبع داده‌ی زنده‌ی هر گرید (دکمه‌ی سه‌نقطه‌ی گوشه) ----

  equipmentSource(): DataSourceInfo {
    return { key: 'rm02-equipment', label: 'تجهیز و سلسله‌مراتب', filterVal: this.companyId };
  }
  attributesSource(): DataSourceInfo {
    return { key: 'rm02-attributes', label: 'ویژگی‌های فنی' };
  }
  capabilitiesSource(): DataSourceInfo {
    return { key: 'rm02-capabilities', label: 'قابلیت تجهیز' };
  }
  toolsSource(): DataSourceInfo {
    return { key: 'rm02-tools', label: 'ابزار و قالب', filterVal: this.companyId };
  }
  changeoverSource(): DataSourceInfo {
    return { key: 'rm02-changeover', label: 'ماتریس زمان تعویض' };
  }
  softwareSource(): DataSourceInfo {
    return { key: 'rm02-software', label: 'نسخه‌ی برنامه‌ی دستگاه' };
  }
  orgTreeSource(): DataSourceInfo {
    return { key: 'rm01-org-tree', label: 'درخت سازمانی', filterVal: this.companyId };
  }
}
