import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EcoView } from './pe10-engine';
import { DAY, NOW, faDM } from '../frm-pe-10.data';

interface Lane { id: number; y: number; x1: number; x2: number; open: boolean; unknown: boolean; label: string; effX: number | null; reqX: number; color: string; tip: string }
interface Tick { x: number; label: string }

const W = 900;

/** خط زمانی ECOها راست‌به‌چپ: دایره = درخواست، لوزی = تاریخ اثر، خط‌چین = تاریخ اثر نامعین، خط نارنجی = اکنون */
@Component({
  selector: 'gng-pe10-timeline',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="tl" [attr.viewBox]="'0 0 ' + W + ' ' + height" role="img" aria-label="خط زمانی تغییرات">
      <g *ngFor="let t of ticks">
        <line [attr.x1]="t.x" [attr.x2]="t.x" y1="14" [attr.y2]="height - 4" class="tl__grid"></line>
        <text [attr.x]="t.x" y="10" text-anchor="middle" class="tl__tick">{{ t.label }}</text>
      </g>
      <line [attr.x1]="nowX" [attr.x2]="nowX" y1="12" [attr.y2]="height" class="tl__now"></line>
      <text [attr.x]="nowX - 3" [attr.y]="height - 4" text-anchor="end" class="tl__nowt">اکنون</text>
      <g *ngFor="let l of lanes" class="tl__lane" (click)="pick.emit(l.id)">
        <line [attr.x1]="l.x1" [attr.x2]="l.x2" [attr.y1]="l.y" [attr.y2]="l.y" [attr.stroke]="l.color" [class.tl__unk]="l.unknown" class="tl__bar"></line>
        <circle [attr.cx]="l.reqX" [attr.cy]="l.y" r="4" [attr.fill]="l.color"><title>{{ l.tip }}</title></circle>
        <path *ngIf="l.effX !== null" [attr.d]="'M' + l.effX + ' ' + (l.y - 6) + ' l6 6 l-6 6 l-6 -6 z'" [attr.fill]="l.color" class="tl__eff"><title>{{ l.tip }}</title></path>
        <text *ngIf="l.unknown" [attr.x]="l.x2 - 6" [attr.y]="l.y + 4" text-anchor="end" class="tl__q">؟</text>
        <text [attr.x]="l.reqX + 8" [attr.y]="l.y - 7" text-anchor="start" class="tl__lbl">{{ l.label }}</text>
      </g>
    </svg>
  `,
  styles: [`
    .tl { width: 100%; display: block; }
    .tl__grid { stroke: rgba(111, 183, 255, 0.12); }
    .tl__tick { fill: #8fb3d9; font-size: 9px; }
    .tl__now { stroke: #ffa94d; stroke-width: 1.5; }
    .tl__nowt { fill: #ffa94d; font-size: 9px; }
    .tl__lane { cursor: pointer; }
    .tl__bar { stroke-width: 3; stroke-linecap: round; opacity: 0.75; }
    .tl__unk { stroke-dasharray: 5 4; }
    .tl__eff { stroke: #fff; stroke-width: 0.8; }
    .tl__q { fill: #ff8a7a; font-size: 14px; font-weight: 800; }
    .tl__lbl { fill: #dbe9ff; font-size: 10px; font-family: monospace; }
  `],
})
export class Pe10TimelineComponent implements OnChanges {
  @Input() views: EcoView[] = [];
  @Output() pick = new EventEmitter<number>();

  readonly W = W;
  height = 120;
  lanes: Lane[] = [];
  ticks: Tick[] = [];
  nowX = 0;

  ngOnChanges(): void {
    const times = this.views.flatMap((v) => [v.eco.requestDate ?? NOW, v.eco.effectiveDate ?? NOW]);
    const t0 = Math.min(NOW, ...times) - 10 * DAY;
    const t1 = Math.max(NOW + 45 * DAY, ...times) + 10 * DAY;
    // راست‌به‌چپ: زمان قدیم‌تر سمت راست
    const x = (t: number): number => W - 20 - ((t - t0) / (t1 - t0)) * (W - 40);
    this.nowX = x(NOW);
    this.height = 30 + this.views.length * 30;
    this.ticks = [];
    const d = new Date(t0);
    for (let m = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); m < t1; m = Date.UTC(new Date(m).getUTCFullYear(), new Date(m).getUTCMonth() + 1, 1))
      if (m > t0) this.ticks.push({ x: x(m), label: faDM(m) });
    this.lanes = this.views.map((v, i) => {
      const req = v.eco.requestDate ?? NOW;
      const eff = v.eco.effectiveDate;
      const unknown = eff === null;
      const end = eff ?? NOW + 40 * DAY;
      const color = !v.open ? '#7fd1ae' : unknown ? '#ff8a7a' : v.eco.status === 3 ? '#ffcf5a' : '#9cc8f5';
      return {
        id: v.eco.id, y: 30 + i * 30, x1: x(req), x2: x(end), open: v.open, unknown, label: v.eco.number, reqX: x(req), effX: eff !== null ? x(eff) : null, color,
        tip: `${v.eco.number} ${v.eco.title} — درخواست ${faDM(req)} · اثر ${v.effLabel}`,
      };
    });
  }
}
