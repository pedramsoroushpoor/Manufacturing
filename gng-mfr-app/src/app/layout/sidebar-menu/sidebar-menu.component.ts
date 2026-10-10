import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TreeModule } from 'primeng/tree';
import { TooltipModule } from 'primeng/tooltip';
import { TreeNode } from 'primeng/api';
import { MenuService } from '../../core/services/menu.service';
import { MenuTreeNode } from '../../core/models/menu-item.model';

@Component({
  selector: 'gng-sidebar-menu',
  standalone: true,
  imports: [CommonModule, TreeModule, TooltipModule],
  templateUrl: './sidebar-menu.component.html',
  styleUrl: './sidebar-menu.component.scss',
})
export class SidebarMenuComponent implements OnChanges {
  /** حالت جمع‌شده — به‌جای مخفی‌شدن کامل درخت، یک ریل آیکونی رنگی نمایش می‌دهد */
  @Input() collapsed = false;
  /**
   * سیستم انتخاب‌شده از پیکر بالای سایدبار (ShellComponent) — با تغییر
   * آن، درخت منو دوباره از همان سیستم بارگذاری می‌شود. تا وقتی فهرست
   * سیستم‌ها لود نشده، null است.
   */
  @Input() subSystemCode: string | null = null;
  /** کلیک روی یک آیکون در حالت جمع‌شده — درخواست باز شدن منو */
  @Output() expand = new EventEmitter<void>();

  nodes: MenuTreeNode[] = [];

  constructor(
    private readonly menuService: MenuService,
    private readonly router: Router,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['subSystemCode'] && this.subSystemCode) {
      this.menuService.getMenuTree(this.subSystemCode).subscribe((nodes) => (this.nodes = nodes));
    }
  }

  onNodeSelect(node: TreeNode): void {
    const menuNode = node as MenuTreeNode;
    const formCode = menuNode.data?.formCode;
    if (formCode) {
      this.router.navigate(['/forms', formCode]);
    }
  }

  onRailClick(node: MenuTreeNode): void {
    this.expand.emit();
    const firstChildFormCode = node.children?.find((c) => c.data?.formCode)?.data?.formCode;
    if (firstChildFormCode) {
      this.router.navigate(['/forms', firstChildFormCode]);
    }
  }
}
