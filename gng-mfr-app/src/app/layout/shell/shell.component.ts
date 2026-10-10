import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { DropdownModule } from 'primeng/dropdown';
import { TopbarComponent } from '../topbar/topbar.component';
import { SidebarMenuComponent } from '../sidebar-menu/sidebar-menu.component';
import { MenuService } from '../../core/services/menu.service';
import { AlmSystemRow } from '../../core/models/menu-item.model';

/** برای به‌خاطرسپاری آخرین سیستم انتخاب‌شده‌ی کاربر بین بازدیدها */
const SELECTED_SYSTEM_STORAGE_KEY = 'gng-mfr-selected-system';

@Component({
  selector: 'gng-shell',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, DropdownModule, TopbarComponent, SidebarMenuComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit {
  sidebarCollapsed = false;

  /**
   * فهرست سیستم‌های سطح صفر (مدیریت تولید، و هر سیستمی که بعداً به
   * alm.Menu اضافه شود — برنامه‌ریزی تولید، بهای تمام‌شده، ...). پیکر
   * انتخاب در نوار برند سایدبار از همین پر می‌شود.
   */
  systems: AlmSystemRow[] = [];
  selectedSystem: AlmSystemRow | null = null;

  constructor(private readonly menuService: MenuService) {}

  ngOnInit(): void {
    this.menuService.getSystems().subscribe((systems) => {
      this.systems = systems;
      if (systems.length === 0) {
        return;
      }
      const savedCode = this.readSavedSystemCode();
      const restored = savedCode ? systems.find((s) => s.subSystemCode === savedCode) : undefined;
      this.selectedSystem = restored ?? systems[0];
    });
  }

  onSystemChange(system: AlmSystemRow): void {
    this.selectedSystem = system;
    try {
      localStorage.setItem(SELECTED_SYSTEM_STORAGE_KEY, system.subSystemCode);
    } catch {
      // اگر localStorage در دسترس نبود (مثلاً حالت خصوصی مرورگر)، اهمیتی ندارد
    }
  }

  onToggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  private readSavedSystemCode(): string | null {
    try {
      return localStorage.getItem(SELECTED_SYSTEM_STORAGE_KEY);
    } catch {
      return null;
    }
  }
}
