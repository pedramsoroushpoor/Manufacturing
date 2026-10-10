import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AREA_COLOR, AREA_LABEL, Area, Problem } from '../frm-pc-13.data';
import { faInt } from '../pc-shared';

interface Blip { key: string; x: number; y: number; r: number; color: string; sev: number; tip: string; on: boolean }
interface Sector { label: string; x: number; y: number; path: string; color: string }

const AREAS: Area[] = ['prod', 'quality', 'material', 'plan', 'outside', 'data'];

/**
 * صفحه‌ی رادار مشکلات: هر حوزه یک قطاع؛ فاصله از مرکز = عکس امتیاز اثر (پراثرترها نزدیک مرکز)،
 * زاویه درون قطاع = سن مشکل (تازه‌ها در لبه‌ی ساعت‌گرد)، اندازه = پول درگیر، رنگ = حوزه، حلقه‌ی قرمز = بحرانی.
 */
@Component({
  selector: 'gng-pc13-radar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="rd" viewBox="-110 -110 220 220" role="img" aria-label="رادار مشکلات">
      <defs>
        <radialGradient id="pc13sweep" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="100">
          <stop offset="0" stop-color="rgba(61,220,132,0.0)"></stop>
          <stop offset="1" stop-color="rgba(61,220,132,0.25)"></stop>
        </radialGradient>
      </defs>
      <circle r="100" class="rd__ring rd__ring--outer"></circle>
      <circle r="75" class="rd__ring"></circle>
      <circle r="50" class="rd__ring"></circle>
      <circle r="25" class="rd__ring rd__ring--core"></circle>
      <path *ngFor="let s of sectors" [attr.d]="s.path" class="rd__spoke"></path>
      <g class="rd__sweep"><path d="M0 0 L100 0 A100 100 0 0 0 86.6 -50 Z" fill="url(#pc13sweep)"></path></g>
      <text *ngFor="let s of sectors" [attr.x]="s.x" [attr.y]="s.y" text-anchor="middle" direction="rtl" class="rd__sec" [attr.fill]="s.color">{{ s.label }}</text>
      <text x="0" y="-27" text-anchor="middle" class="rd__rl">اثر بالا</text>
      <g *ngFor="let b of blips; trackBy: byKey" class="rd__blip" (click)="pick.emit(b.key)">
        <circle *ngIf="b.sev >= 3" [attr.cx]="b.x" [attr.cy]="b.y" [attr.r]="b.r + 2.2" class="rd__crit"></circle>
        <circle [attr.cx]="b.x" [attr.cy]="b.y" [attr.r]="b.r" [attr.fill]="b.color" [class.rd__dot--on]="b.on" class="rd__dot"><title>{{ b.tip }}</title></circle>
      </g>
    </svg>
  `,
  styles: [`
    .rd { width: 100%; max-height: 24rem; display: block; }
    .rd__ring { fill: none; stroke: rgba(61, 220, 132, 0.22); stroke-width: 0.5; }
    .rd__ring--outer { fill: rgba(6, 20, 14, 0.35); stroke: rgba(61, 220, 132, 0.4); }
    .rd__ring--core { fill: rgba(255, 93, 93, 0.07); stroke: rgba(255, 93, 93, 0.35); }
    .rd__spoke { stroke: rgba(61, 220, 132, 0.18); stroke-width: 0.5; fill: none; }
    .rd__sweep { transform-origin: 0 0; animation: rdsweep 6s linear infinite; pointer-events: none; }
    @keyframes rdsweep { to { transform: rotate(-360deg); } }
    .rd__sec { font-size: 6.4px; font-weight: 700; }
    .rd__rl { font-size: 4.4px; fill: #ffa8a8; }
    .rd__blip { cursor: pointer; }
    .rd__dot { fill-opacity: 0.85; stroke: #0b0e14; stroke-width: 0.6; }
    .rd__dot--on { stroke: #fff; stroke-width: 1.4; }
    .rd__crit { fill: none; stroke: #ff5d5d; stroke-width: 0.8; stroke-dasharray: 2 1.4; }
    @media (prefers-reduced-motion: reduce) { .rd__sweep { animation: none; } }
  `],
})
export class Pc13RadarComponent implements OnChanges {
  @Input() problems: Problem[] = [];
  @Input() selected: string | null = null;
  @Output() pick = new EventEmitter<string>();

  blips: Blip[] = [];
  sectors: Sector[] = [];

  ngOnChanges(): void {
    const n = AREAS.length;
    const slice = (2 * Math.PI) / n;
    this.sectors = AREAS.map((a, i) => {
      const ang = -Math.PI / 2 - i * slice;
      const mid = ang - slice / 2;
      return {
        label: AREA_LABEL[a], color: AREA_COLOR[a], x: Math.cos(mid) * 107 * 0.93, y: Math.sin(mid) * 107 * 0.93 + 2,
        path: `M0 0 L${(Math.cos(ang) * 100).toFixed(2)} ${(Math.sin(ang) * 100).toFixed(2)}`,
      };
    });
    const maxScore = Math.max(1, ...this.problems.map((p) => p.score));
    const maxAge = Math.max(1, ...this.problems.map((p) => p.ageH));
    const maxMoney = Math.max(1, ...this.problems.map((p) => p.money));
    this.blips = this.problems.map((p, k) => {
      const i = AREAS.indexOf(p.area);
      const start = -Math.PI / 2 - i * slice;
      // پخش اندک برای جلوگیری از هم‌پوشانی
      const jitter = ((k * 37) % 11) / 11 - 0.5;
      const ang = start - slice * (0.12 + 0.76 * Math.min(1, Math.sqrt(p.ageH / maxAge))) + jitter * slice * 0.08;
      const rad = 14 + (1 - p.score / maxScore) * 80;
      return {
        key: p.key, x: Math.cos(ang) * rad, y: Math.sin(ang) * rad, r: 2.6 + Math.sqrt(p.money / maxMoney) * 5, color: AREA_COLOR[p.area], sev: p.sev,
        tip: `${p.title} · امتیاز ${faInt(p.score)} · ${p.owner}`, on: p.key === this.selected,
      };
    });
  }

  byKey(_: number, b: Blip): string {
    return b.key;
  }
}
