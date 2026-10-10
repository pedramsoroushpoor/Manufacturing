import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlmFormCoverage, AlmFormSpecService, openAlmFormSpec } from '../../core/services/alm-form-spec.service';

/**
 * دکمه‌ی «کد فرم» بالای هر فرم. کنار کد، پوشش فیچر را از ALM نشان می‌دهد
 * (مثلاً «۵ از ۶ فیچر») و با کلیک، شناسنامه‌ی کامل فرم را در تب جدا باز می‌کند.
 * اگر ALM در دسترس نباشد فقط کد دیده می‌شود.
 */
@Component({
  selector: 'gng-form-code-chip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button type="button" class="fcc" (click)="open()" [title]="hint">
      <span class="fcc__code">{{ code }}</span>
      <span class="fcc__cov" *ngIf="coverage as c">
        <span class="fcc__bar"><span class="fcc__fill" [style.width.%]="percent"></span></span>
        {{ fa(c.implemented) }} از {{ fa(c.total) }} فیچر
      </span>
      <i class="pi pi-external-link"></i>
    </button>
  `,
  styles: [
    `
      .fcc {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        font: inherit;
        font-size: 0.72rem;
        line-height: inherit;
        padding: 0.15rem 0.6rem;
        border-radius: 999px;
        cursor: pointer;
        color: var(--gng-primary-dark);
        border: 1px solid var(--gng-primary-light);
        background: rgba(247, 148, 29, 0.08);
        transition: background 0.15s, border-color 0.15s;
      }
      .fcc:hover {
        background: rgba(247, 148, 29, 0.18);
        border-color: var(--gng-primary);
      }
      .fcc:focus-visible {
        outline: 2px solid var(--gng-primary);
        outline-offset: 2px;
      }
      .fcc__code {
        font-family: 'Courier New', monospace;
      }
      .fcc__cov {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding-inline-start: 0.45rem;
        border-inline-start: 1px solid var(--gng-primary-light);
        color: var(--gng-text);
        white-space: nowrap;
      }
      .fcc__bar {
        display: inline-block;
        width: 2.4rem;
        height: 0.35rem;
        border-radius: 999px;
        background: var(--gng-border);
        overflow: hidden;
      }
      .fcc__fill {
        display: block;
        height: 100%;
        background: var(--gng-primary);
      }
      .fcc i {
        font-size: 0.62rem;
      }
    `,
  ],
})
export class FormCodeChipComponent implements OnChanges {
  @Input({ required: true }) code!: string;
  coverage?: AlmFormCoverage;

  constructor(private readonly alm: AlmFormSpecService) {}

  ngOnChanges(): void {
    this.coverage = undefined;
    if (!this.code) return;
    this.alm.coverage(this.code).subscribe({
      next: (c) => (this.coverage = c.total > 0 ? c : undefined),
      error: () => (this.coverage = undefined),
    });
  }

  get percent(): number {
    return this.coverage && this.coverage.total ? (100 * this.coverage.implemented) / this.coverage.total : 0;
  }

  get hint(): string {
    const c = this.coverage;
    return c
      ? `این فرم باید ${this.fa(c.total)} فیچر را پوشش دهد؛ ${this.fa(c.implemented)} فیچر پیاده شده (${this.fa(c.delivered)} تحویل نهایی). برای جزئیات کلیک کنید — در تب جدید باز می‌شود.`
      : 'مشخصات این فرم در ALM (تب جدید)';
  }

  fa(n: number): string {
    return n.toLocaleString('fa-IR');
  }

  open(): void {
    openAlmFormSpec(this.code);
  }
}
