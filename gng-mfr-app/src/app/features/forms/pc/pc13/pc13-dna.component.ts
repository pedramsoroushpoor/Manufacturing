import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DnaRow } from '../frm-pc-13.data';

/**
 * «DNA سفارش‌ها»: هر دستور یک نوار باریک در طول دامنه؛ هر رویداد یک تیک رنگی (توقف قرمز با طول = دقیقه،
 * NC نارنجی، پارامتر بنفش، رسید سبز، انحراف سفید، تغییر زرد). پنجره‌ی برنامه نوار کم‌رنگ و سررسید پرچم است.
 */
@Component({
  selector: 'gng-pc13-dna',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dna">
      <div class="dna__row dna__row--axis">
        <div></div>
        <div class="dna__strip dna__strip--axis">
          <span class="dna__sep" *ngFor="let d of days" [style.right.%]="d.x"><i>{{ d.label }}</i></span>
        </div>
        <div class="dna__meta-h">پیشرفت / شدت</div>
      </div>
      <div class="dna__row" *ngFor="let r of rows; trackBy: byId" [class.dna__row--focus]="r.focus" (click)="pick.emit(r.id)" [title]="r.label + ' — کلیک: تمرکز روی دستور'">
        <div class="dna__name">
          <b [class.dna__late]="r.late">{{ r.wo }}</b>
          <span>{{ r.line }} · {{ r.status }}</span>
        </div>
        <div class="dna__strip">
          <span class="dna__sep" *ngFor="let d of days" [style.right.%]="d.x"></span>
          <span class="dna__plan" *ngIf="r.planW" [style.right.%]="r.planX" [style.width.%]="r.planW"></span>
          <span class="dna__tick" *ngFor="let k of r.ticks" [class.dna__tick--tall]="k.tall" [class.dna__tick--ghost]="k.t > t"
            [style.right.%]="k.x" [style.width.%]="k.w" [style.background]="k.color" [title]="k.tip"></span>
          <span class="dna__due" *ngIf="r.dueX !== null" [style.right.%]="r.dueX" [title]="r.dueLabel">⚑</span>
          <span class="dna__due-out" *ngIf="r.dueOut === 'after'" [title]="r.dueLabel">{{ r.dueLabel }} ←</span>
          <span class="dna__play" [style.right.%]="playX"></span>
        </div>
        <div class="dna__meta">
          <div class="dna__prog"><div [style.width.%]="r.progress"></div></div>
          <span>{{ r.roughLabel }}</span>
        </div>
      </div>
      <div class="dna__legend">
        <span><i style="background:#ff5d5d"></i>توقف (طول = دقیقه)</span><span><i style="background:#ff9f43"></i>عدم‌انطباق / مازاد</span>
        <span><i style="background:#b57cff"></i>پارامتر</span><span><i style="background:#3ddc84"></i>رسید / تکمیل</span>
        <span><i style="background:#fff"></i>انحراف</span><span><i style="background:#ffd43b"></i>تغییر</span><span><i style="background:#4dabf7"></i>حمل / پیمانکار</span>
        <span><i class="dna__lg-plan"></i>پنجره‌ی برنامه</span><span>⚑ سررسید</span>
      </div>
    </div>
  `,
  styles: [`
    .dna { display: flex; flex-direction: column; gap: 4px; }
    .dna__row { display: grid; grid-template-columns: 8.5rem 1fr 10rem; gap: 0.6rem; align-items: center; cursor: pointer; border-radius: 6px; padding: 2px 4px; }
    .dna__row:hover { background: rgba(255,255,255,0.04); }
    .dna__row--axis { cursor: default; }
    .dna__row--axis:hover { background: none; }
    .dna__row--focus { background: rgba(247,148,29,0.12); box-shadow: inset -3px 0 0 var(--gng-primary); }
    .dna__name { display: flex; flex-direction: column; line-height: 1.25; }
    .dna__name b { font-size: 0.8rem; color: #e9eef4; font-family: monospace; }
    .dna__name span { font-size: 0.66rem; color: #9fb0c2; }
    .dna__late { color: #ff8787 !important; }
    .dna__strip { position: relative; height: 1.35rem; background: rgba(255,255,255,0.03); border-radius: 4px; overflow: hidden; }
    .dna__strip--axis { height: 1rem; background: none; overflow: visible; }
    .dna__sep { position: absolute; top: 0; bottom: 0; border-right: 1px solid rgba(255,255,255,0.08); }
    .dna__sep i { position: absolute; right: 3px; top: -1px; font-style: normal; font-size: 0.6rem; color: #9fb0c2; white-space: nowrap; }
    .dna__plan { position: absolute; top: 3px; bottom: 3px; background: rgba(116,192,252,0.13); border: 1px dashed rgba(116,192,252,0.4); border-radius: 3px; }
    .dna__tick { position: absolute; top: 35%; bottom: 35%; min-width: 2px; border-radius: 1px; transform: translateX(50%); }
    .dna__tick--tall { top: 8%; bottom: 8%; }
    .dna__tick--ghost { opacity: 0.18; }
    .dna__due { position: absolute; top: -2px; transform: translateX(50%); color: #ffd43b; font-size: 0.9rem; line-height: 1; }
    .dna__due-out { position: absolute; left: 3px; top: 2px; font-size: 0.6rem; color: #9fb0c2; }
    .dna__play { position: absolute; top: 0; bottom: 0; border-right: 1px solid rgba(255,255,255,0.75); }
    .dna__meta { display: flex; flex-direction: column; gap: 2px; font-size: 0.64rem; color: #9fb0c2; line-height: 1.2; }
    .dna__meta-h { font-size: 0.64rem; color: #9fb0c2; }
    .dna__prog { height: 4px; border-radius: 9px; background: rgba(255,255,255,0.08); overflow: hidden; }
    .dna__prog div { height: 100%; background: var(--gng-teal); }
    .dna__legend { display: flex; flex-wrap: wrap; gap: 0.9rem; font-size: 0.66rem; color: #9fb0c2; margin-top: 0.4rem; }
    .dna__legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-left: 4px; vertical-align: middle; }
    .dna__lg-plan { background: rgba(116,192,252,0.18); border: 1px dashed rgba(116,192,252,0.6); }
  `],
})
export class Pc13DnaComponent {
  @Input() rows: DnaRow[] = [];
  @Input() days: { x: number; label: string }[] = [];
  @Input() t = 0;
  @Input() playX = 0;
  @Output() pick = new EventEmitter<number>();

  byId(_: number, r: DnaRow): number {
    return r.id;
  }
}
