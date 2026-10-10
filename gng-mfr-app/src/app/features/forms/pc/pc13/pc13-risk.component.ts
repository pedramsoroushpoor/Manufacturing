import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RiskPoint } from '../frm-pc-13.data';

/**
 * ماتریس خطر تحویل: افقی = حاشیه تا سررسید (ریشه‌ی علامت‌دار ساعت؛ راست = دیر)، عمودی = درصد کار مانده،
 * اندازه = حجم کار (ساعت استاندارد). نقطه‌های دیر می‌تپند.
 */
@Component({
  selector: 'gng-pc13-risk',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="rk" [class.rk--big]="big" viewBox="0 0 160 100" role="img" aria-label="ماتریس خطر تحویل">
      <rect x="80" y="4" width="76" height="46" class="rk__q rk__q--danger"></rect>
      <rect x="80" y="50" width="76" height="46" class="rk__q rk__q--warn"></rect>
      <rect x="4" y="4" width="76" height="46" class="rk__q rk__q--watch"></rect>
      <rect x="4" y="50" width="76" height="46" class="rk__q rk__q--ok"></rect>
      <line x1="80" y1="2" x2="80" y2="98" class="rk__axis"></line>
      <line x1="2" y1="50" x2="158" y2="50" class="rk__axis rk__axis--soft"></line>
      <text x="154" y="9" direction="rtl" text-anchor="start" class="rk__ql">دیر · کار زیاد مانده</text>
      <text x="154" y="94" direction="rtl" text-anchor="start" class="rk__ql">دیر · نزدیک پایان</text>
      <text x="78" y="9" direction="rtl" text-anchor="start" class="rk__ql">به‌موقع · کار زیاد</text>
      <text x="78" y="94" direction="rtl" text-anchor="start" class="rk__ql">امن</text>
      <text x="81.5" y="54" direction="rtl" text-anchor="start" class="rk__ax">سررسید</text>
      <g *ngFor="let p of points; trackBy: byId" (click)="pick.emit(p.id)" class="rk__pt">
        <circle *ngIf="p.late" [attr.cx]="p.x * 1.6" [attr.cy]="p.y" [attr.r]="p.r" class="rk__pulse"></circle>
        <circle [attr.cx]="p.x * 1.6" [attr.cy]="p.y" [attr.r]="p.r" [class.rk__dot--late]="p.late" class="rk__dot"><title>{{ p.tip }}</title></circle>
        <text [attr.x]="p.x * 1.6" [attr.y]="p.y + 1.1" text-anchor="middle" class="rk__lbl">{{ p.label }}</text>
      </g>
    </svg>
  `,
  styles: [`
    .rk { width: 100%; height: auto; max-height: 15rem; display: block; }
    .rk--big { max-height: 30rem; }
    .rk__q { stroke: none; }
    .rk__q--danger { fill: rgba(255, 93, 93, 0.12); }
    .rk__q--warn { fill: rgba(255, 181, 71, 0.08); }
    .rk__q--watch { fill: rgba(77, 171, 247, 0.06); }
    .rk__q--ok { fill: rgba(61, 220, 132, 0.06); }
    .rk__axis { stroke: rgba(255,255,255,0.5); stroke-width: 0.3; stroke-dasharray: 1.2 1; }
    .rk__axis--soft { stroke: rgba(255,255,255,0.18); }
    .rk__ql { font-size: 3.1px; fill: #9fb0c2; }
    .rk__ax { font-size: 2.6px; fill: #cfd8e3; }
    .rk__pt { cursor: pointer; }
    .rk__dot { fill: rgba(77, 171, 247, 0.55); stroke: #74c0fc; stroke-width: 0.35; }
    .rk__dot--late { fill: rgba(255, 93, 93, 0.75); stroke: #ffa8a8; }
    .rk__pulse { fill: none; stroke: #ff5d5d; stroke-width: 0.5; transform-box: fill-box; transform-origin: center; animation: rkpulse 1.6s ease-out infinite; }
    @keyframes rkpulse { 0% { transform: scale(1); opacity: 0.9; } 100% { transform: scale(2.6); opacity: 0; } }
    .rk__lbl { font-size: 2.4px; fill: #fff; font-weight: 700; pointer-events: none; font-family: monospace; }
  `],
})
export class Pc13RiskComponent {
  @Input() points: RiskPoint[] = [];
  @Input() big = false;
  @Output() pick = new EventEmitter<number>();

  byId(_: number, p: RiskPoint): number {
    return p.id;
  }
}
