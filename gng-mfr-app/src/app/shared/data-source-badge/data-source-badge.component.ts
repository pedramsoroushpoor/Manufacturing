import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { API_BASE_URL } from '../../core/api-config';

/**
 * توصیف یک «منبع داده» برای یک گرید/پنل مشخص — کلید باید دقیقاً با یکی از
 * کلیدهای INSPECT_REGISTRY در gng-mfr-api/server.js یکی باشد. نام SP/جدول
 * واقعی هیچ‌وقت از این‌جا به بک‌اند نمی‌رود — فقط همین کلید، تا کلاینت
 * نتواند اسم آبجکت دلخواهی بخواند.
 */
export interface DataSourceInfo {
  key: string;
  /** عنوانی که روی پنل نشان داده می‌شود (مثلاً «ایستگاه کاری»). */
  label: string;
  /** اگر این گرید با یک شناسه (مثلاً LineId یا CompanyId) فیلتر شده، همان مقدار. */
  filterVal?: number;
}

/**
 * «منبع داده زنده» — دکمه‌ی کوچک سه‌نقطه‌ی گوشه‌ی هر گرید/فرم.
 *
 * تصمیم سیستمی (نه فقط FRM-RM-01): طبق درخواست کاربر، این از همین‌جا به بعد
 * استاندارد کل سیستم GNG+ است — روی هر گرید یا فرمی که از این الگو استفاده
 * می‌کند باید همین دکمه باشد تا در لحظه‌ی دمو/بررسی بتوان دید این گرید از
 * کدام Stored Procedure و کدام جدول واقعی می‌خواند، و چند ردیف خامِ همان
 * جدول را مستقیم از Pilot دید — بدون لازم‌بودن SSMS باز.
 *
 * عمداً کم‌رنگ و در حاشیه (opacity کم تا hover) طراحی شده تا در دموی
 * مدیریتی به چشم کاربر نهایی نیاید ولی هر وقت لازم شد در یک کلیک در دسترس
 * باشد.
 */
@Component({
  selector: 'gng-data-source-badge',
  standalone: true,
  imports: [CommonModule, ButtonModule, OverlayPanelModule, TabViewModule, TableModule, TooltipModule],
  templateUrl: './data-source-badge.component.html',
  styleUrl: './data-source-badge.component.scss',
})
export class DataSourceBadgeComponent {
  @Input({ required: true }) source!: DataSourceInfo;

  loading = false;
  loaded = false;
  error = '';
  procedure = '';
  table = '';
  definitionSql = '';
  sampleRows: Record<string, unknown>[] = [];
  sampleColumns: string[] = [];

  constructor(private http: HttpClient) {}

  load(): void {
    if (this.loaded || this.loading) return;
    this.loading = true;
    this.error = '';
    const params: Record<string, string> = {};
    if (this.source.filterVal !== undefined) {
      params['filterVal'] = String(this.source.filterVal);
    }
    this.http.get<{ procedure: string; table: string; definitionSql: string; sampleRows: Record<string, unknown>[] }>(
      `${API_BASE_URL}/api/_inspect/${this.source.key}`,
      { params }
    ).subscribe({
      next: (r) => {
        this.procedure = r.procedure;
        this.table = r.table;
        this.definitionSql = r.definitionSql;
        this.sampleRows = r.sampleRows || [];
        this.sampleColumns = this.sampleRows.length ? Object.keys(this.sampleRows[0]) : [];
        this.loaded = true;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'خواندن منبع داده ناموفق بود: ' + (err?.error?.message || err?.message || 'خطای نامشخص');
        this.loading = false;
      },
    });
  }

  reload(): void {
    this.loaded = false;
    this.load();
  }
}
