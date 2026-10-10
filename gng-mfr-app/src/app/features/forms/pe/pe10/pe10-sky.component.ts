import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Cluster, StarEdge, StarNode } from './pe10-engine';

interface Dust { x: number; y: number; r: number; o: number }

/**
 * صورت‌فلکی محصولات: هر کالا یک ستاره، هر گروه کالا یک خوشه (آرایش آفتابگردانی ثابت)، اندازه = دامنه‌ی اثر
 * (کاربرد معکوس + دستور + درخواست)، رنگ = امتیاز سلامت مهندسی، حلقه‌ی تپنده = نقص بحرانی. خط‌ها = پیوند ساختار.
 */
@Component({
  selector: 'gng-pe10-sky',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="sky" viewBox="0 -10 1000 640" role="img" aria-label="صورت‌فلکی محصولات">
      <defs>
        <filter id="pe10glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3.2" result="b"></feGaussianBlur>
          <feMerge><feMergeNode in="b"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge>
        </filter>
      </defs>
      <circle *ngFor="let d of dust" [attr.cx]="d.x" [attr.cy]="d.y" [attr.r]="d.r" class="sky__dust" [attr.opacity]="d.o"></circle>
      <g *ngFor="let c of clusters">
        <circle [attr.cx]="c.x" [attr.cy]="c.y" [attr.r]="c.r" class="sky__cl"></circle>
        <text [attr.x]="c.x" [attr.y]="c.ly" text-anchor="middle" direction="rtl" class="sky__cll">{{ c.label }}</text>
      </g>
      <line *ngFor="let e of edges" [attr.x1]="e.x1" [attr.y1]="e.y1" [attr.x2]="e.x2" [attr.y2]="e.y2" class="sky__e"
        [class.sky__e--hot]="selected !== null && (e.a === selected || e.b === selected)"></line>
      <g *ngFor="let n of nodes; trackBy: byId" class="sky__n" [class.sky__n--dim]="n.dim" (click)="pick.emit(n.id)">
        <circle *ngIf="n.critical" [attr.cx]="n.x" [attr.cy]="n.y" [attr.r]="n.r + 4" class="sky__pulse"></circle>
        <circle *ngIf="n.id === selected" [attr.cx]="n.x" [attr.cy]="n.y" [attr.r]="n.r + 7" class="sky__sel"></circle>
        <circle [attr.cx]="n.x" [attr.cy]="n.y" [attr.r]="n.r" [attr.fill]="n.color" filter="url(#pe10glow)" class="sky__star"><title>{{ n.tip }}</title></circle>
        <text *ngIf="n.r > 6.5 || n.id === selected" [attr.x]="n.x" [attr.y]="n.y + n.r + 9" text-anchor="middle" class="sky__lbl">{{ n.code }}</text>
      </g>
    </svg>
  `,
  styles: [`
    .sky { width: 100%; display: block; max-height: 36rem; }
    .sky__dust { fill: #cfe6ff; }
    .sky__cl { fill: rgba(111, 183, 255, 0.04); stroke: rgba(111, 183, 255, 0.35); stroke-width: 0.8; stroke-dasharray: 3 4; }
    .sky__cll { fill: #9cc8f5; font-size: 12px; font-weight: 700; }
    .sky__e { stroke: rgba(160, 205, 255, 0.13); stroke-width: 0.8; }
    .sky__e--hot { stroke: #ffcf5a; stroke-width: 1.6; stroke-dasharray: 4 3; animation: pe10dash 1.2s linear infinite; }
    @keyframes pe10dash { to { stroke-dashoffset: -14; } }
    .sky__n { cursor: pointer; }
    .sky__n--dim { opacity: 0.16; }
    .sky__star { stroke: rgba(255, 255, 255, 0.75); stroke-width: 0.7; }
    .sky__n:hover .sky__star { stroke: #fff; stroke-width: 1.6; }
    .sky__sel { fill: none; stroke: #ffcf5a; stroke-width: 1.4; }
    .sky__pulse { fill: none; stroke: #ff6b6b; stroke-width: 1.2; transform-box: fill-box; transform-origin: center; animation: pe10pulse 2.2s ease-out infinite; }
    @keyframes pe10pulse { 0% { opacity: 0.9; transform: scale(0.85); } 100% { opacity: 0; transform: scale(1.9); } }
    .sky__lbl { fill: #dbe9ff; font-size: 8.5px; font-family: monospace; pointer-events: none; }
    @media (prefers-reduced-motion: reduce) { .sky__pulse, .sky__e--hot { animation: none; } }
  `],
})
export class Pe10SkyComponent implements OnChanges {
  @Input() nodes: StarNode[] = [];
  @Input() edges: StarEdge[] = [];
  @Input() clusters: Cluster[] = [];
  @Input() selected: number | null = null;
  @Output() pick = new EventEmitter<number>();

  /** غبار ستاره‌ای تزئینی با مولد شبه‌تصادفی ثابت (هر بار همان آسمان) */
  readonly dust: Dust[] = (() => {
    let seed = 7;
    const rnd = (): number => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    return Array.from({ length: 140 }, () => ({ x: rnd() * 1000, y: rnd() * 620, r: 0.3 + rnd() * 0.9, o: 0.15 + rnd() * 0.4 }));
  })();

  ngOnChanges(): void {
    // ستاره‌ی انتخاب‌شده و ستاره‌های پرنقص آخر کشیده شوند تا روی بقیه بیایند
    this.nodes = [...this.nodes].sort((a, c) => Number(a.id === this.selected) - Number(c.id === this.selected) || Number(a.critical) - Number(c.critical));
  }

  byId(_: number, n: StarNode): number {
    return n.id;
  }
}
