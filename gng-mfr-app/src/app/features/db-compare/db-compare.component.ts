import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { MultiSelectModule } from 'primeng/multiselect';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { DbCompareService, DbSchema, DbTable } from './db-compare.service';
import { ColumnDiff, PairStatus, TablePair, columnText, pairTables } from './db-compare.model';

type Filter = 'all' | PairStatus | 'matched';

const DEFAULT_LEFT = ['mes'];
const DEFAULT_RIGHT = ['mfr', 'generalmfr'];

/**
 * «بررسی دیتابیس» — ابزار توسعه. جدول‌های دو دسته اسکیما را کنار هم می‌گذارد:
 * هم‌نام‌ها روبه‌روی هم، و با باز کردن هر ردیف مغایرت فیلدها دیده می‌شود.
 * اسکیماهای هر طرف انتخابی‌اند تا در سیستم‌های دیگر هم به کار بیاید؛ پیش‌فرض
 * این پروژه: چپ mes، راست mfr و generalmfr.
 */
@Component({
  selector: 'gng-db-compare',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, MultiSelectModule, CheckboxModule, InputTextModule],
  templateUrl: './db-compare.component.html',
  styleUrl: './db-compare.component.scss',
})
export class DbCompareComponent implements OnInit {
  schemas: DbSchema[] = [];
  leftSchemas: string[] = [];
  rightSchemas: string[] = [];
  /** اسکیماهایی که آخرین مقایسه با آن‌ها انجام شده (سرستون‌ها از این می‌آیند). */
  comparedLeft: string[] = [];
  comparedRight: string[] = [];

  ignoreStandard = true;
  search = '';
  filter: Filter = 'all';

  loading = false;
  errorText = '';

  private leftTables: DbTable[] = [];
  private rightTables: DbTable[] = [];
  pairs: TablePair[] = [];
  private readonly open = new Set<string>();

  readonly filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'همه' },
    { key: 'matched', label: 'هم‌نام' },
    { key: 'different', label: 'هم‌نام با مغایرت' },
    { key: 'same', label: 'هم‌نام و یکسان' },
    { key: 'left-only', label: 'فقط چپ' },
    { key: 'right-only', label: 'فقط راست' },
  ];

  constructor(private readonly db: DbCompareService) {}

  ngOnInit(): void {
    this.db.schemas().subscribe({
      next: (schemas) => {
        this.schemas = schemas;
        const has = (n: string) => schemas.some((s) => s.name === n);
        this.leftSchemas = DEFAULT_LEFT.filter(has);
        this.rightSchemas = DEFAULT_RIGHT.filter(has);
        if (this.canCompare) this.compare();
      },
      error: () => (this.errorText = 'خواندن فهرست اسکیماها ناموفق بود. اتصال gng-mfr-api را بررسی کنید.'),
    });
  }

  get canCompare(): boolean {
    return this.leftSchemas.length > 0 && this.rightSchemas.length > 0;
  }

  compare(): void {
    if (!this.canCompare) return;
    this.loading = true;
    this.errorText = '';
    const left = [...this.leftSchemas];
    const right = [...this.rightSchemas];
    forkJoin({ l: this.db.tables(left), r: this.db.tables(right) }).subscribe({
      next: ({ l, r }) => {
        this.leftTables = l;
        this.rightTables = r;
        this.comparedLeft = left;
        this.comparedRight = right;
        this.open.clear();
        this.rebuild();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.errorText = 'خواندن ساختار جدول‌ها ناموفق بود.';
      },
    });
  }

  /** با عوض شدنِ «نادیده گرفتن ستون‌های استاندارد» فقط مقایسه از نو حساب می‌شود، نه خواندن از دیتابیس. */
  rebuild(): void {
    this.pairs = pairTables(this.leftTables, this.rightTables, this.ignoreStandard);
  }

  swapSides(): void {
    [this.leftSchemas, this.rightSchemas] = [this.rightSchemas, this.leftSchemas];
    if (this.canCompare) this.compare();
  }

  // ---- فیلتر و شمارش ----

  count(filter: Filter): number {
    return this.pairs.filter((p) => this.matches(p, filter)).length;
  }

  private matches(p: TablePair, filter: Filter): boolean {
    if (filter === 'all') return true;
    if (filter === 'matched') return p.status === 'same' || p.status === 'different';
    return p.status === filter;
  }

  get visible(): TablePair[] {
    const q = this.search.trim().toLowerCase();
    return this.pairs.filter((p) => this.matches(p, this.filter) && (!q || p.name.toLowerCase().includes(q)));
  }

  // ---- باز و بسته کردن ردیف‌ها ----

  isOpen(p: TablePair): boolean {
    return this.open.has(p.key);
  }

  toggle(p: TablePair): void {
    if (this.open.has(p.key)) this.open.delete(p.key);
    else this.open.add(p.key);
  }

  expandAll(): void {
    for (const p of this.visible) this.open.add(p.key);
  }

  collapseAll(): void {
    this.open.clear();
  }

  // ---- متن‌ها ----

  statusLabel(p: TablePair): string {
    switch (p.status) {
      case 'same':
        return 'یکسان';
      case 'different':
        return 'مغایرت';
      case 'left-only':
        return 'فقط چپ';
      default:
        return 'فقط راست';
    }
  }

  summary(p: TablePair): string {
    if (p.status === 'left-only' || p.status === 'right-only') return `${this.fa(p.columns.length)} فیلد`;
    const parts: string[] = [];
    if (p.differentCount) parts.push(`${this.fa(p.differentCount)} متفاوت`);
    if (p.leftOnlyCount) parts.push(`${this.fa(p.leftOnlyCount)} فقط چپ`);
    if (p.rightOnlyCount) parts.push(`${this.fa(p.rightOnlyCount)} فقط راست`);
    return parts.length ? parts.join(' · ') : `${this.fa(p.sameCount)} فیلد یکسان`;
  }

  columnStatusLabel(c: ColumnDiff): string {
    switch (c.status) {
      case 'same':
        return 'یکسان';
      case 'different':
        return `متفاوت: ${c.reason}`;
      case 'left-only':
        return 'فقط چپ';
      default:
        return 'فقط راست';
    }
  }

  text = columnText;

  fa(n: number): string {
    return n.toLocaleString('fa-IR');
  }

  trackPair(_: number, p: TablePair): string {
    return p.key;
  }
}
