import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { JAxisTick, JBar, JLane, KIND_LABEL } from '../frm-pc-13.data';
import { faDMT } from '../frm-pc-13.data';
import { faDuration, faNum } from '../pc-shared';

export interface JourneyView { lanes: JLane[]; ticks: JAxisTick[]; playX: number; nowX: number; dueX: number | null; dueOut: string; planX: number; planW: number }
interface Card { title: string; kind: string; when: string; detail: string; extra: string }

/**
 * مسیر سفارش به‌صورت «خطوط شنا»: برنامه، عملیات (متوقف هاشور، برون‌سپاری متمایز)، رخدادها، مواد، کیفیت و رسید، بیرون؛
 * خط پخش = لحظه‌ی نوار زمان. کلیک روی هر نشانه کارت رویداد را باز می‌کند.
 */
@Component({
  selector: 'gng-pc13-journey',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="jr" *ngIf="view">
      <div class="jr__lane jr__lane--axis">
        <div class="jr__title"></div>
        <div class="jr__track jr__track--axis">
          <span class="jr__tick" *ngFor="let k of view.ticks" [class.jr__tick--major]="k.major" [style.right.%]="k.x"><i>{{ k.label }}</i></span>
          <span class="jr__dueout" *ngIf="view.dueOut">{{ view.dueOut }}</span>
        </div>
      </div>
      <div class="jr__lane" *ngFor="let l of view.lanes" [ngClass]="'jr__lane--' + l.key">
        <div class="jr__title">{{ l.title }}</div>
        <div class="jr__rows">
          <div class="jr__track" *ngFor="let row of l.rows">
            <span class="jr__tick jr__tick--grid" *ngFor="let k of view.ticks" [style.right.%]="k.x"></span>
            <span class="jr__planwin" *ngIf="l.key === 'plan' && view.planW" [style.right.%]="view.planX" [style.width.%]="view.planW"></span>
            <ng-container *ngFor="let b of row">
              <span *ngIf="!b.point" class="jr__bar" [ngClass]="b.cls" [style.right.%]="b.x" [style.width.%]="b.w" [title]="b.tip" (click)="open(b)">
                <em *ngIf="b.label">{{ b.label }}</em>
              </span>
              <span *ngIf="b.point" class="jr__pt" [ngClass]="b.cls" [style.right.%]="b.x" [title]="b.tip" (click)="open(b)"></span>
            </ng-container>
            <span class="jr__due" *ngIf="view.dueX !== null" [style.right.%]="view.dueX"></span>
            <span class="jr__now" [style.right.%]="view.nowX"></span>
            <span class="jr__play" [style.right.%]="view.playX"></span>
          </div>
        </div>
      </div>
      <div class="jr__legend">
        <span><i class="jr__lg jr__lg--plan"></i>برنامه</span><span><i class="jr__lg jr__lg--done"></i>تکمیل</span><span><i class="jr__lg jr__lg--run"></i>در جریان</span>
        <span><i class="jr__lg jr__lg--paused"></i>متوقف</span><span><i class="jr__lg jr__lg--out"></i>برون‌سپاری</span><span><i class="jr__lg jr__lg--stop"></i>توقف</span>
        <span><i class="jr__lg jr__lg--due"></i>سررسید</span><span><i class="jr__lg jr__lg--now"></i>ساعت سناریو</span><span><i class="jr__lg jr__lg--play"></i>نوار زمان</span>
      </div>
      <div class="jr__card" *ngIf="card">
        <button type="button" class="jr__x" (click)="card = null" title="بستن">×</button>
        <div class="jr__card-k">{{ card.kind }} · {{ card.when }}</div>
        <div class="jr__card-t">{{ card.title }}</div>
        <div class="jr__card-d" *ngIf="card.detail">{{ card.detail }}</div>
        <div class="jr__card-d" *ngIf="card.extra">{{ card.extra }}</div>
      </div>
    </div>
  `,
  styles: [`
    .jr { position: relative; display: flex; flex-direction: column; gap: 3px; }
    .jr__lane { display: grid; grid-template-columns: 6.5rem 1fr; gap: 0.5rem; align-items: stretch; }
    .jr__title { font-size: 0.74rem; font-weight: 700; color: #cfd8e3; display: flex; align-items: center; border-left: 2px solid rgba(255,255,255,0.08); }
    .jr__rows { display: flex; flex-direction: column; gap: 2px; padding: 3px 0; background: rgba(255,255,255,0.025); border-radius: 6px; }
    .jr__track { position: relative; height: 1.05rem; }
    .jr__lane--evt .jr__track, .jr__lane--qc .jr__track, .jr__lane--mat .jr__track, .jr__lane--out .jr__track { height: 1.5rem; }
    .jr__track--axis { height: 1.1rem; }
    .jr__tick { position: absolute; top: 0; bottom: 0; border-right: 1px solid rgba(255,255,255,0.08); }
    .jr__tick--major { border-right-color: rgba(255,255,255,0.22); }
    .jr__tick i { position: absolute; right: 3px; top: 0; font-style: normal; font-size: 0.6rem; color: #9fb0c2; white-space: nowrap; }
    .jr__tick--grid { border-right-color: rgba(255,255,255,0.05); }
    .jr__planwin { position: absolute; top: 0; bottom: 0; background: rgba(116,192,252,0.06); }
    .jr__bar { position: absolute; top: 2px; bottom: 2px; border-radius: 3px; cursor: pointer; overflow: hidden; min-width: 3px; }
    .jr__bar em { font-style: normal; font-size: 0.6rem; color: #0b0e14; padding: 0 3px; white-space: nowrap; line-height: 0.95rem; display: block; }
    .jr__bar.plan { background: rgba(116,192,252,0.18); border: 1px dashed rgba(116,192,252,0.55); }
    .jr__bar.plan em { color: #a5d8ff; }
    .jr__bar.done { background: #3ddc84; }
    .jr__bar.run { background: #4dabf7; box-shadow: 0 0 6px rgba(77,171,247,0.6); }
    .jr__bar.paused { background: repeating-linear-gradient(135deg, #ffb547 0 4px, #6b4a12 4px 8px); }
    .jr__bar.out { background: repeating-linear-gradient(90deg, #b57cff 0 6px, #6c3fb3 6px 12px); }
    .jr__bar.stop { background: #ff5d5d; top: 4px; bottom: 4px; }
    .jr__bar.future, .jr__pt.future { opacity: 0.22; }
    .jr__pt { position: absolute; top: 50%; width: 9px; height: 9px; transform: translate(50%, -50%) rotate(45deg); cursor: pointer; background: #8a9bb0; border: 1px solid #0b0e14; }
    .jr__pt.hot { width: 11px; height: 11px; box-shadow: 0 0 6px rgba(255,255,255,0.5); }
    .jr__pt.k-nc, .jr__pt.k-excess { background: #ff9f43; }
    .jr__pt.k-param { background: #b57cff; }
    .jr__pt.k-change { background: #ffd43b; }
    .jr__pt.k-deviation { background: #fff; }
    .jr__pt.k-receipt, .jr__pt.k-complete { background: #3ddc84; }
    .jr__pt.k-release { background: #74c0fc; }
    .jr__pt.k-close { background: #adb5bd; }
    .jr__pt.k-ship, .jr__pt.k-ctr { background: #4dabf7; }
    .jr__pt.k-kit { background: #22c1c3; }
    .jr__dueout { position: absolute; left: 0; top: 0; font-size: 0.64rem; color: #ffd43b; background: var(--gng-dark-900); padding: 0 0.3rem; border-radius: 4px; }
    .jr__due { position: absolute; top: -2px; bottom: -2px; border-right: 2px solid #ffd43b; }
    .jr__now { position: absolute; top: -2px; bottom: -2px; border-right: 1px dotted var(--gng-primary); }
    .jr__play { position: absolute; top: -2px; bottom: -2px; border-right: 2px solid #fff; box-shadow: 0 0 6px rgba(255,255,255,0.5); }
    .jr__legend { display: flex; flex-wrap: wrap; gap: 0.8rem; font-size: 0.66rem; color: #9fb0c2; margin-top: 0.4rem; }
    .jr__lg { display: inline-block; width: 14px; height: 8px; border-radius: 2px; margin-left: 4px; vertical-align: middle; }
    .jr__lg--plan { border: 1px dashed #74c0fc; } .jr__lg--done { background: #3ddc84; } .jr__lg--run { background: #4dabf7; }
    .jr__lg--paused { background: repeating-linear-gradient(135deg, #ffb547 0 3px, #6b4a12 3px 6px); } .jr__lg--out { background: #b57cff; } .jr__lg--stop { background: #ff5d5d; }
    .jr__lg--due { width: 2px; background: #ffd43b; } .jr__lg--now { width: 2px; background: var(--gng-primary); } .jr__lg--play { width: 2px; background: #fff; }
    .jr__card { position: absolute; left: 0.5rem; top: 1.6rem; width: 19rem; background: #0b0e14; border: 1px solid var(--gng-primary); border-radius: 10px; padding: 0.7rem 0.9rem; box-shadow: 0 8px 28px rgba(0,0,0,0.6); z-index: 5; }
    .jr__x { position: absolute; left: 0.4rem; top: 0.2rem; background: none; border: none; color: #9fb0c2; font-size: 1.2rem; cursor: pointer; }
    .jr__card-k { font-size: 0.68rem; color: var(--gng-primary-light); }
    .jr__card-t { font-weight: 800; font-size: 0.86rem; margin: 0.2rem 0; color: #fff; }
    .jr__card-d { font-size: 0.76rem; color: #cfd8e3; }
  `],
})
export class Pc13JourneyComponent implements OnChanges {
  @Input() view: JourneyView | null = null;
  card: Card | null = null;

  ngOnChanges(): void {
    if (this.card && !this.view) this.card = null;
  }

  open(b: JBar): void {
    const e = b.ev;
    this.card = e
      ? {
          title: e.title, kind: KIND_LABEL[e.kind], when: faDMT(e.t), detail: e.detail,
          extra: [e.qty !== null ? `مقدار ${faNum(e.qty)}` : '', e.min !== null ? `مدت ${faDuration(e.min)}` : '', e.ref ? `مرجع ${e.ref}` : ''].filter((x) => !!x).join(' · '),
        }
      : { title: b.label || 'عملیات', kind: 'میله', when: '', detail: b.tip, extra: '' };
  }
}
