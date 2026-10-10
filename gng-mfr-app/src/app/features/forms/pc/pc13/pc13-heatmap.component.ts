import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeatCell, HeatDay, HeatRow } from '../frm-pc-13.data';

/** نقشه‌ی حرارتی خط × روز؛ کلیک روی خانه دامنه را به همان روز و خط می‌برد. */
@Component({
  selector: 'gng-pc13-heatmap',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="hm" [style.grid-template-columns]="cols">
      <div class="hm__corner">خط / روز</div>
      <div class="hm__day" *ngFor="let d of days" [class.hm__day--today]="d.today">
        <b>{{ d.label }}</b><span>{{ d.weekday }}</span>
      </div>
      <div class="hm__corner">جمع</div>
      <ng-container *ngFor="let r of rows">
        <div class="hm__line">{{ r.line }}</div>
        <button type="button" class="hm__cell" *ngFor="let c of r.cells" [class.hm__cell--future]="c.future" [class.hm__cell--on]="c.on"
          (click)="pick.emit(c)" [title]="r.line + ' · ' + c.label + ' — کلیک: فیلتر دامنه به همین روز و خط'">
          <span class="hm__fill" [style.background]="color" [style.opacity]="c.level ? 0.14 + c.level * 0.86 : 0"></span>
          <span class="hm__val" [class.hm__val--hot]="c.level > 0.55">{{ c.label }}</span>
        </button>
        <div class="hm__total">{{ r.total }}</div>
      </ng-container>
    </div>
  `,
  styles: [`
    .hm { display: grid; gap: 3px; direction: rtl; overflow-x: auto; }
    .hm__corner { font-size: 0.68rem; color: #9fb0c2; align-self: end; padding-bottom: 0.2rem; }
    .hm__day { text-align: center; font-size: 0.66rem; color: #9fb0c2; display: flex; flex-direction: column; line-height: 1.3; padding-bottom: 0.2rem; }
    .hm__day b { color: #e9eef4; font-weight: 600; }
    .hm__day--today b { color: var(--gng-primary-light); }
    .hm__line { font-size: 0.78rem; font-weight: 700; display: flex; align-items: center; color: #e9eef4; }
    .hm__cell { position: relative; height: 2.6rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.03); cursor: pointer; padding: 0; overflow: hidden; font-family: inherit; }
    .hm__cell:hover { border-color: rgba(255,255,255,0.45); }
    .hm__cell--future { background: repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0 5px, transparent 5px 10px); }
    .hm__cell--on { outline: 2px solid var(--gng-primary); }
    .hm__fill { position: absolute; inset: 0; }
    .hm__val { position: relative; font-size: 0.72rem; color: #cfd8e3; font-variant-numeric: tabular-nums; }
    .hm__val--hot { color: #fff; font-weight: 800; }
    .hm__total { font-size: 0.72rem; color: #9fb0c2; display: flex; align-items: center; justify-content: center; }
  `],
})
export class Pc13HeatmapComponent {
  @Input() days: HeatDay[] = [];
  @Input() rows: HeatRow[] = [];
  @Input() color = '#ff5d5d';
  @Output() pick = new EventEmitter<HeatCell>();

  get cols(): string {
    return `5rem repeat(${this.days.length}, minmax(3.2rem, 1fr)) 4rem`;
  }
}
