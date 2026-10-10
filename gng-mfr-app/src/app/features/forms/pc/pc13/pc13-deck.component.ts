import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgendaItem, KpiTile, Problem, RiskPoint, WaterStep } from '../frm-pc-13.data';
import { faInt } from '../pc-shared';
import { Pc13RiskComponent } from './pc13-risk.component';
import { Pc13WaterfallComponent } from './pc13-waterfall.component';

/**
 * «حالت ارائه»: اسلایدهای تمام‌صفحه از روی دستور جلسه، با زمان‌سنج معکوس هر بند، شمارنده‌ی اسلاید و
 * کلیدهای ← / → (راست‌به‌چپ: ← بعدی) و Esc برای خروج.
 */
@Component({
  selector: 'gng-pc13-deck',
  standalone: true,
  imports: [CommonModule, Pc13RiskComponent, Pc13WaterfallComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dk" dir="rtl">
      <div class="dk__top">
        <div class="dk__brand">اتاق جلسه‌ی کنترل تولید <span>· {{ scopeLabel }}</span></div>
        <div class="dk__timer" *ngIf="index > 0" [class.dk__timer--over]="remaining < 0" [class.dk__timer--warn]="remaining >= 0 && remaining < 60">
          <i class="pi pi-clock"></i> {{ timerLabel }}
        </div>
        <div class="dk__count">{{ faInt(index + 1) }} از {{ faInt(items.length + 1) }}</div>
        <button type="button" class="dk__x" (click)="close.emit()" title="خروج (Esc)">×</button>
      </div>

      <div class="dk__slide" *ngIf="index === 0">
        <div class="dk__kicker">جلسه‌ی هفتگی کنترل تولید</div>
        <h1 class="dk__h1">{{ scopeLabel }}</h1>
        <div class="dk__big3">
          <div *ngFor="let k of tiles.slice(0, 4)" class="dk__bigk"><b>{{ k.value }}</b><span>{{ k.label }} {{ k.unit }}</span><em [class]="'dk__d dk__d--' + k.deltaTone">{{ k.delta }}</em></div>
        </div>
        <ol class="dk__toc">
          <li *ngFor="let it of items">{{ it.title }} <span>{{ faInt(it.minutes) }} دقیقه</span></li>
        </ol>
        <div class="dk__hint">← اسلاید بعد · → اسلاید قبل · Esc خروج — مجموع {{ faInt(totalMinutes) }} دقیقه</div>
      </div>

      <div class="dk__slide" *ngIf="current as it">
        <div class="dk__kicker">بند {{ faInt(it.no) }} از {{ faInt(items.length) }} · {{ faInt(it.minutes) }} دقیقه</div>
        <h1 class="dk__h1">{{ it.title }}</h1>
        <div class="dk__body" [class.dk__body--split]="it.visual === 'kpi' || it.visual === 'risk'">
          <div *ngIf="it.visual === 'kpi'" class="dk__viz">
            <div class="dk__big3 dk__big3--tight">
              <div *ngFor="let k of tiles.slice(0, 3)" class="dk__bigk"><b>{{ k.value }}</b><span>{{ k.label }} {{ k.unit }}</span><em [class]="'dk__d dk__d--' + k.deltaTone">{{ k.delta }}</em></div>
            </div>
            <gng-pc13-waterfall [steps]="steps" [big]="true"></gng-pc13-waterfall>
          </div>
          <div *ngIf="it.visual === 'risk'" class="dk__viz"><gng-pc13-risk [points]="risk" [big]="true"></gng-pc13-risk></div>
          <div *ngIf="it.visual === 'problems'" class="dk__probs">
            <div class="dk__prob" *ngFor="let p of problems.slice(0, 5); let i = index">
              <div class="dk__rank">{{ faInt(i + 1) }}</div>
              <div class="dk__pmain">
                <div class="dk__ptitle">{{ p.title }}</div>
                <div class="dk__pstory">{{ p.story }}</div>
                <div class="dk__pdec"><b>پیشنهاد تصمیم:</b> {{ p.decision }} <span>· مسئول: {{ p.owner }}</span></div>
              </div>
              <div class="dk__pscore"><b>{{ faInt(p.score) }}</b><div class="dk__pbar"><div [style.width.%]="p.score"></div></div></div>
            </div>
            <div class="dk__empty" *ngIf="!problems.length">{{ it.empty }}</div>
          </div>
          <ul class="dk__lines" *ngIf="it.visual !== 'problems' && it.visual !== 'kpi'">
            <li *ngFor="let l of it.lines" [class]="'dk__l dk__l--' + l.tone">{{ l.text }}<small *ngIf="l.meta">{{ l.meta }}</small></li>
            <li *ngIf="!it.lines.length" class="dk__empty">{{ it.empty }}</li>
          </ul>
        </div>
        <div class="dk__note" *ngIf="notes[it.id]"><b>یادداشت:</b> {{ notes[it.id] }}</div>
      </div>

      <div class="dk__nav">
        <button type="button" (click)="prev()" [disabled]="index === 0">→ قبلی</button>
        <div class="dk__dots"><span *ngFor="let d of dots; let i = index" [class.on]="i === index" (click)="go(i)"></span></div>
        <button type="button" (click)="next()" [disabled]="index >= items.length">بعدی ←</button>
      </div>
    </div>
  `,
  styles: [`
    :host { position: fixed; inset: 0; z-index: 4000; display: block; }
    .dk { position: absolute; inset: 0; background: radial-gradient(ellipse at top right, #1d2b3a 0%, #0b0e14 65%); color: #eef1f6; display: flex; flex-direction: column; padding: 1.4rem 2.4rem; overflow: auto; font-family: var(--gng-font); }
    .dk__top { display: flex; align-items: center; gap: 1.5rem; }
    .dk__brand { font-weight: 800; font-size: 1.05rem; color: var(--gng-primary-light); flex: 1; }
    .dk__brand span { color: #9fb0c2; font-weight: 400; }
    .dk__timer { font-family: monospace; font-size: 1.9rem; font-weight: 800; padding: 0.1rem 0.8rem; border-radius: 10px; background: rgba(255,255,255,0.06); }
    .dk__timer--warn { color: #ffd43b; }
    .dk__timer--over { color: #fff; background: #c92a2a; animation: dkblink 1s step-end infinite; }
    @keyframes dkblink { 50% { opacity: 0.6; } }
    .dk__count { font-size: 1.1rem; color: #9fb0c2; }
    .dk__x { background: none; border: 1px solid #3d5368; color: #eef1f6; border-radius: 8px; width: 2.4rem; height: 2.4rem; font-size: 1.4rem; cursor: pointer; }
    .dk__slide { flex: 1; display: flex; flex-direction: column; padding: 1.2rem 0; min-height: 0; }
    .dk__kicker { color: var(--gng-primary-light); font-size: 1.1rem; letter-spacing: 0.02em; }
    .dk__h1 { font-size: 2.6rem; margin: 0.3rem 0 1.2rem; line-height: 1.2; }
    .dk__big3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 1.2rem; margin-bottom: 1.6rem; }
    .dk__big3--tight { margin-bottom: 2.4rem; }
    .dk__bigk { background: rgba(255,255,255,0.05); border-radius: 14px; padding: 1rem 1.3rem; display: flex; flex-direction: column; gap: 0.2rem; border-top: 3px solid var(--gng-primary); }
    .dk__bigk b { font-size: 2.6rem; line-height: 1.1; }
    .dk__bigk span { color: #9fb0c2; font-size: 1rem; }
    .dk__d { font-style: normal; font-size: 1rem; }
    .dk__d--good { color: #3ddc84; } .dk__d--bad { color: #ff8787; } .dk__d--flat, .dk__d--none { color: #9fb0c2; }
    .dk__toc { font-size: 1.35rem; line-height: 2.1; margin: 0; padding-right: 1.6rem; }
    .dk__toc span { color: #9fb0c2; font-size: 1rem; margin-right: 0.6rem; }
    .dk__hint { margin-top: auto; color: #9fb0c2; font-size: 0.95rem; }
    .dk__body { display: grid; gap: 2rem; flex: 1; min-height: 0; }
    .dk__body--split { grid-template-columns: 1.4fr 1fr; align-items: start; }
    .dk__viz { min-width: 0; }
    .dk__lines { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
    .dk__l { font-size: 1.45rem; line-height: 1.45; padding: 0.4rem 1rem; border-right: 5px solid #4dabf7; background: rgba(255,255,255,0.04); border-radius: 8px; }
    .dk__l small { display: block; font-size: 1rem; color: #9fb0c2; }
    .dk__l--danger { border-right-color: #ff5d5d; } .dk__l--warning { border-right-color: #ffb547; } .dk__l--success { border-right-color: #3ddc84; } .dk__l--muted { border-right-color: #5c7080; color: #cfd8e3; }
    .dk__probs { display: flex; flex-direction: column; gap: 0.9rem; }
    .dk__prob { display: grid; grid-template-columns: 3rem 1fr 8rem; gap: 1rem; align-items: center; background: rgba(255,255,255,0.04); border-radius: 12px; padding: 0.7rem 1rem; }
    .dk__rank { font-size: 2.2rem; font-weight: 900; color: var(--gng-primary); text-align: center; }
    .dk__ptitle { font-size: 1.35rem; font-weight: 800; }
    .dk__pstory { font-size: 1.02rem; color: #cfd8e3; }
    .dk__pdec { font-size: 1rem; color: #ffd8a8; margin-top: 0.2rem; }
    .dk__pdec span { color: #9fb0c2; }
    .dk__pscore b { font-size: 1.8rem; }
    .dk__pbar { height: 6px; background: rgba(255,255,255,0.1); border-radius: 9px; overflow: hidden; }
    .dk__pbar div { height: 100%; background: linear-gradient(90deg, #ff5d5d, #ffb547); }
    .dk__empty { color: #9fb0c2; font-size: 1.3rem; }
    .dk__note { margin-top: 1rem; background: rgba(255,212,59,0.08); border: 1px dashed rgba(255,212,59,0.5); border-radius: 10px; padding: 0.6rem 1rem; font-size: 1.1rem; }
    .dk__nav { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .dk__nav button { background: rgba(255,255,255,0.07); color: #eef1f6; border: 1px solid #3d5368; border-radius: 10px; padding: 0.5rem 1.2rem; font-size: 1rem; cursor: pointer; font-family: inherit; }
    .dk__nav button:disabled { opacity: 0.3; cursor: default; }
    .dk__dots { display: flex; gap: 0.5rem; }
    .dk__dots span { width: 0.7rem; height: 0.7rem; border-radius: 50%; background: #3d5368; cursor: pointer; }
    .dk__dots span.on { background: var(--gng-primary); }
    @media (max-width: 900px) { .dk__body--split { grid-template-columns: 1fr; } .dk__h1 { font-size: 1.8rem; } }
  `],
})
export class Pc13DeckComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() items: AgendaItem[] = [];
  @Input() tiles: KpiTile[] = [];
  @Input() steps: WaterStep[] = [];
  @Input() risk: RiskPoint[] = [];
  @Input() problems: Problem[] = [];
  @Input() notes: Record<string, string> = {};
  @Input() scopeLabel = '';
  @Output() close = new EventEmitter<void>();

  index = 0;
  remaining = 0;
  timerLabel = '';
  dots: number[] = [];
  totalMinutes = 0;
  readonly faInt = faInt;
  private timer: ReturnType<typeof setInterval> | null = null;
  private slideStart = Date.now();
  private wasFull = false;
  private readonly onFs = () => {
    if (this.wasFull && !document.fullscreenElement) this.close.emit();
    this.wasFull = !!document.fullscreenElement;
  };

  constructor(private host: ElementRef<HTMLElement>, private cdr: ChangeDetectorRef) {}

  get current(): AgendaItem | null {
    return this.index > 0 ? this.items[this.index - 1] ?? null : null;
  }

  ngOnInit(): void {
    this.dots = Array.from({ length: this.items.length + 1 }, (_, i) => i);
    this.totalMinutes = this.items.reduce((a, it) => a + it.minutes, 0);
    this.tick();
    this.timer = setInterval(() => {
      this.tick();
      this.cdr.markForCheck();
    }, 1000);
  }

  ngAfterViewInit(): void {
    document.addEventListener('fullscreenchange', this.onFs);
    try {
      const el = this.host.nativeElement;
      if (el.requestFullscreen) el.requestFullscreen().catch(() => undefined);
    } catch {
      /* تمام‌صفحه در دسترس نیست؛ پوشش ثابت کافی است */
    }
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    document.removeEventListener('fullscreenchange', this.onFs);
    try {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    } catch {
      /* — */
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowLeft' || e.key === 'PageDown' || e.key === ' ') {
      e.preventDefault();
      this.next();
    } else if (e.key === 'ArrowRight' || e.key === 'PageUp') {
      e.preventDefault();
      this.prev();
    } else if (e.key === 'Escape') this.close.emit();
  }

  next(): void {
    this.go(Math.min(this.items.length, this.index + 1));
  }

  prev(): void {
    this.go(Math.max(0, this.index - 1));
  }

  go(i: number): void {
    if (i === this.index) return;
    this.index = i;
    this.slideStart = Date.now();
    this.tick();
    this.cdr.markForCheck();
  }

  private tick(): void {
    const it = this.current;
    const total = (it?.minutes ?? 0) * 60;
    this.remaining = total - Math.floor((Date.now() - this.slideStart) / 1000);
    const a = Math.abs(this.remaining);
    const mm = Math.floor(a / 60).toString().padStart(2, '0');
    const ss = (a % 60).toString().padStart(2, '0');
    this.timerLabel = `${this.remaining < 0 ? '+' : ''}${mm}:${ss}`.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
  }
}
