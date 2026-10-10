import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RippleResult } from './pe10-engine';

interface Dot { x: number; y: number; r: number; color: string; label: string; tip: string; lx: number; ly: number; anchor: string }

const STATE_COLOR: Record<string, string> = { ok: '#7fd1ae', sub: '#7cc4ff', partial: '#ffcf5a', blocked: '#ff6b6b', risk: '#ff9f6b' };

/**
 * موج اثر نرسیدن یک ماده: مرکز = ماده؛ حلقه‌ی ۱ = دستورهای مصرف‌کننده‌ی مستقیم (رنگ = پوشش)؛ حلقه‌ی ۲ = ساختارهای
 * وابسته (هر سطح کاربرد معکوس دورتر) و دستورهای پایین‌دستی؛ حلقه‌ی ۳ = درخواست‌های تولید در معرض.
 */
@Component({
  selector: 'gng-pe10-ripple',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="rp" viewBox="-260 -170 520 340" role="img" aria-label="موج اثر">
      <circle r="150" class="rp__wave"></circle>
      <circle r="150" class="rp__wave rp__wave--2"></circle>
      <circle r="52" class="rp__ring"></circle>
      <circle r="100" class="rp__ring"></circle>
      <circle r="148" class="rp__ring"></circle>
      <text x="0" y="-55" text-anchor="middle" class="rp__rl">دستورها</text>
      <text x="0" y="-103" text-anchor="middle" class="rp__rl">ساختارها و پایین‌دست</text>
      <text x="0" y="-151" text-anchor="middle" class="rp__rl">درخواست‌ها</text>
      <circle r="22" class="rp__core"></circle>
      <text x="0" y="4" text-anchor="middle" class="rp__ct">{{ center }}</text>
      <g *ngFor="let d of dots">
        <circle [attr.cx]="d.x" [attr.cy]="d.y" [attr.r]="d.r" [attr.fill]="d.color" class="rp__dot"><title>{{ d.tip }}</title></circle>
        <text [attr.x]="d.lx" [attr.y]="d.ly" [attr.text-anchor]="d.anchor" class="rp__lbl">{{ d.label }}</text>
      </g>
    </svg>
  `,
  styles: [`
    .rp { width: 100%; max-height: 22rem; display: block; }
    .rp__ring { fill: none; stroke: rgba(111, 183, 255, 0.3); stroke-dasharray: 2 4; }
    .rp__wave { fill: none; stroke: rgba(255, 207, 90, 0.5); stroke-width: 1.5; transform-origin: 0 0; animation: pe10wave 3.6s ease-out infinite; }
    .rp__wave--2 { animation-delay: 1.8s; }
    @keyframes pe10wave { 0% { transform: scale(0.15); opacity: 0.9; } 100% { transform: scale(1); opacity: 0; } }
    .rp__core { fill: #ffcf5a; stroke: #fff; stroke-width: 1; }
    .rp__ct { font-size: 8px; font-weight: 800; fill: #0b2440; font-family: monospace; }
    .rp__rl { font-size: 7px; fill: #8fb3d9; }
    .rp__dot { stroke: rgba(255, 255, 255, 0.8); stroke-width: 0.8; }
    .rp__lbl { font-size: 7px; fill: #dbe9ff; font-family: monospace; }
    @media (prefers-reduced-motion: reduce) { .rp__wave { animation: none; opacity: 0.2; } }
  `],
})
export class Pe10RippleComponent implements OnChanges {
  @Input() result: RippleResult | null = null;
  center = '';
  dots: Dot[] = [];

  ngOnChanges(): void {
    const r = this.result;
    this.dots = [];
    if (!r) return;
    this.center = r.material.code;
    const ring = (radius: number, items: { label: string; tip: string; color: string; size: number }[], offset: number): void => {
      items.forEach((it, i) => {
        const a = -Math.PI / 2 + offset + (i / Math.max(1, items.length)) * 2 * Math.PI;
        const x = Math.cos(a) * radius;
        const y = Math.sin(a) * radius;
        this.dots.push({
          x, y, r: it.size, color: it.color, label: it.label, tip: it.tip, lx: x + (x >= 0 ? 1 : -1) * (it.size + 3), ly: y + 3, anchor: x >= 0 ? 'start' : 'end',
        });
      });
    };
    const byWo = new Map<string, { state: string; short: number }>();
    const rank: Record<string, number> = { ok: 0, sub: 1, partial: 2, blocked: 3 };
    for (const row of r.rows) {
      const o = byWo.get(row.wo);
      if (!o || rank[row.state] > rank[o.state]) byWo.set(row.wo, { state: row.state, short: (o?.short ?? 0) + row.short });
    }
    ring(52, [...byWo.entries()].map(([wo, o]) => ({ label: wo.slice(-4), tip: `${wo} — ${o.state}`, color: STATE_COLOR[o.state], size: 5 })), 0.2);
    const mid = [
      ...r.levels.flatMap((l) => l.structures.map((s) => ({ label: s.code, tip: `${s.code} ${s.title} — سطح ${l.level} · ${s.openOrders} دستور باز`, color: l.level === 1 ? '#9cc8f5' : '#6f8fb5', size: 3 + Math.min(4, s.openOrders) }))),
      ...r.downstream.map((d) => ({ label: d.wo.slice(-4), tip: `${d.wo} — ${d.reason}`, color: STATE_COLOR[d.state], size: 4.5 })),
    ];
    ring(100, mid, 0.5);
    ring(148, r.requests.map((q) => ({ label: q.number.slice(-4), tip: `${q.number} ${q.product} — ${q.reason}`, color: STATE_COLOR[q.state], size: 4 })), 0.9);
  }
}
