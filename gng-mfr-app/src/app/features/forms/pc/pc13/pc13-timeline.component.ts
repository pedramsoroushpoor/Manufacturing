import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, OnChanges, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SEV_COLOR } from '../frm-pc-13.data';

interface Rect { x: number; y: number; w: number; h: number; c: string }

/** «ماشین زمان»: نوار زمانی راست‌به‌چپ دامنه با چگالی رویداد، جداکننده‌ی روزها و هد پخش کشیدنی. */
@Component({
  selector: 'gng-pc13-timeline',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tm">
      <div class="tm__ctrl">
        <button type="button" class="tm__btn" (click)="playing ? pause.emit() : play.emit()" [title]="playing ? 'توقف موقت' : 'بازپخش — هر ۲۵۰ میلی‌ثانیه یک ساعت'">
          <i [class]="playing ? 'pi pi-pause' : 'pi pi-play'"></i>
        </button>
        <button type="button" class="tm__btn" (click)="stop.emit()" title="توقف و بازگشت به ابتدای دامنه"><i class="pi pi-stop"></i></button>
        <button type="button" class="tm__btn tm__btn--now" (click)="goNow.emit()" title="بازگشت به ساعت سناریو">الان</button>
        <span class="tm__badge" [class.tm__badge--past]="isPast">{{ tLabel }}</span>
      </div>
      <div class="tm__track" #track (pointerdown)="down($event)" (pointermove)="move($event)" (pointerup)="up($event)" (pointercancel)="up($event)">
        <svg class="tm__spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
          <rect *ngFor="let r of rects" [attr.x]="r.x" [attr.y]="r.y" [attr.width]="r.w" [attr.height]="r.h" [attr.fill]="r.c"></rect>
        </svg>
        <div class="tm__future" *ngIf="nowX < 100" [style.left.%]="0" [style.width.%]="100 - nowX" title="آینده‌ی برنامه‌ای (پس از ساعت سناریو)"></div>
        <div class="tm__day" *ngFor="let d of days" [style.right.%]="d.x"><span>{{ d.label }}</span></div>
        <div class="tm__now" [style.right.%]="nowX"></div>
        <div class="tm__head" [style.right.%]="playX"><span class="tm__knob"></span></div>
      </div>
    </div>
  `,
  styles: [`
    .tm { display: grid; grid-template-columns: auto 1fr; gap: 0.8rem; align-items: stretch; }
    .tm__ctrl { display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap; max-width: 15rem; }
    .tm__btn { background: var(--gng-dark-700); color: #e9eef4; border: 1px solid var(--gng-dark-border); border-radius: 8px; height: 2rem; min-width: 2rem; cursor: pointer; font-family: inherit; font-size: 0.78rem; }
    .tm__btn:hover { border-color: var(--gng-primary); }
    .tm__btn--now { padding: 0 0.6rem; color: var(--gng-primary-light); }
    .tm__badge { font-size: 0.74rem; color: #9fb0c2; padding: 0.2rem 0.5rem; border-radius: 6px; border: 1px dashed transparent; }
    .tm__badge--past { color: #ffd43b; border-color: rgba(255, 212, 59, 0.6); background: rgba(255, 212, 59, 0.08); font-weight: 700; }
    .tm__track { position: relative; height: 4.2rem; border-radius: 8px; background: rgba(0, 0, 0, 0.25); border: 1px solid var(--gng-dark-border); cursor: ew-resize; touch-action: none; user-select: none; overflow: hidden; }
    .tm__spark { position: absolute; inset: 0.9rem 0 0 0; width: 100%; height: calc(100% - 0.9rem); }
    .tm__future { position: absolute; top: 0; bottom: 0; background: repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 6px, transparent 6px 12px); pointer-events: none; }
    .tm__day { position: absolute; top: 0; bottom: 0; border-right: 1px solid rgba(255, 255, 255, 0.12); pointer-events: none; }
    .tm__day span { position: absolute; top: 1px; right: 4px; font-size: 0.62rem; color: #9fb0c2; white-space: nowrap; }
    .tm__now { position: absolute; top: 0; bottom: 0; width: 0; border-right: 2px dotted var(--gng-primary); pointer-events: none; }
    .tm__head { position: absolute; top: 0; bottom: 0; width: 0; border-right: 2px solid #fff; box-shadow: 0 0 8px rgba(255,255,255,0.6); pointer-events: none; }
    .tm__knob { position: absolute; bottom: -1px; right: -7px; width: 12px; height: 12px; border-radius: 50%; background: #fff; }
  `],
})
export class Pc13TimelineComponent implements OnChanges {
  @Input() from = 0;
  @Input() to = 0;
  @Input() max = 0;
  @Input() t = 0;
  @Input() now = 0;
  @Input() density: { x: number; w: number; h: number[] }[] = [];
  @Input() days: { x: number; label: string }[] = [];
  @Input() tLabel = '';
  @Input() isPast = false;
  @Input() playing = false;
  @Output() seek = new EventEmitter<number>();
  @Output() play = new EventEmitter<void>();
  @Output() pause = new EventEmitter<void>();
  @Output() stop = new EventEmitter<void>();
  @Output() goNow = new EventEmitter<void>();
  @ViewChild('track', { static: true }) track!: ElementRef<HTMLDivElement>;

  rects: Rect[] = [];
  playX = 0;
  nowX = 100;
  private dragging = false;

  ngOnChanges(): void {
    const span = this.to - this.from;
    this.playX = span > 0 ? Math.max(0, Math.min(100, ((this.t - this.from) / span) * 100)) : 0;
    this.nowX = span > 0 ? Math.max(0, Math.min(100, ((this.now - this.from) / span) * 100)) : 100;
    const out: Rect[] = [];
    for (const b of this.density) {
      let y = 40;
      for (let s = 0; s < 4; s++) {
        const h = (b.h[s] / 100) * 38;
        if (h <= 0) continue;
        y -= h;
        out.push({ x: 100 - b.x - b.w, y, w: Math.max(0.12, b.w * 0.9), h, c: SEV_COLOR[s] });
      }
    }
    this.rects = out;
  }

  private at(ev: PointerEvent): number {
    const r = this.track.nativeElement.getBoundingClientRect();
    const frac = r.width > 0 ? (r.right - ev.clientX) / r.width : 0;
    const v = this.from + Math.max(0, Math.min(1, frac)) * (this.to - this.from);
    return Math.max(this.from, Math.min(this.max, v));
  }

  down(ev: PointerEvent): void {
    this.dragging = true;
    try {
      this.track.nativeElement.setPointerCapture(ev.pointerId);
    } catch {
      /* مرورگر قدیمی */
    }
    this.seek.emit(this.at(ev));
  }

  move(ev: PointerEvent): void {
    if (this.dragging) this.seek.emit(this.at(ev));
  }

  up(ev: PointerEvent): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.seek.emit(this.at(ev));
  }
}
