import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MinutesDoc } from '../frm-pc-13.data';
import { faInt } from '../pc-shared';

/**
 * صفحه‌ی چاپی صورت‌جلسه. روی صفحه پنهان است؛ هنگام «چاپ صورت‌جلسه» یک نسخه از آن به body افزوده می‌شود و
 * CSS چاپ (سراسری، بدون کپسوله‌سازی؛ همه با پیشوند pc13p-) بقیه‌ی برنامه را پنهان می‌کند.
 */
@Component({
  selector: 'gng-pc13-minutes',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="pc13p-root" *ngIf="doc" dir="rtl">
      <header class="pc13p-head">
        <div>
          <h1>{{ doc.title }}</h1>
          <div class="pc13p-sub">{{ doc.scope }} · تاریخ جلسه {{ doc.date }}</div>
        </div>
        <div class="pc13p-draft">پیش‌نویس محلی؛ ثبت رسمی در فاز ویرایش</div>
      </header>
      <section class="pc13p-item" *ngFor="let it of doc.items">
        <h2>{{ faInt(it.no) }}. {{ it.title }} <span>({{ faInt(it.minutes) }} دقیقه)</span></h2>
        <ul>
          <li *ngFor="let l of it.lines" [class]="'pc13p-' + l.tone">{{ l.text }}<small *ngIf="l.meta"> — {{ l.meta }}</small></li>
          <li *ngIf="!it.lines.length" class="pc13p-muted">{{ it.empty }}</li>
        </ul>
        <div class="pc13p-notes">
          <b>یادداشت / تصمیم:</b>
          <p>{{ doc.notes[it.id] || '……………………………………………………………………' }}</p>
        </div>
      </section>
      <footer class="pc13p-foot">
        <div><b>مسئولان مرتبط:</b> {{ doc.owners.join('، ') }}</div>
        <div class="pc13p-sign"><span>امضای مدیر تولید</span><span>امضای دبیر جلسه</span></div>
      </footer>
    </div>
  `,
  styles: [`
    .pc13p-root { display: none; }
    @media print {
      body.pc13-printing > *:not(.pc13p-host) { display: none !important; }
      body.pc13-printing { background: #fff !important; }
      .pc13p-host .pc13p-root { display: block; color: #000; font-family: Vazirmatn, Tahoma, sans-serif; font-size: 10.5pt; padding: 0 4mm; }
      .pc13p-head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 3mm; margin-bottom: 4mm; }
      .pc13p-head h1 { font-size: 16pt; margin: 0; }
      .pc13p-sub { font-size: 9.5pt; color: #333; }
      .pc13p-draft { border: 1px dashed #555; padding: 1mm 3mm; font-size: 8.5pt; }
      .pc13p-item { break-inside: avoid; margin-bottom: 4mm; }
      .pc13p-item h2 { font-size: 12pt; margin: 0 0 1.5mm; }
      .pc13p-item h2 span { font-weight: 400; font-size: 9pt; color: #444; }
      .pc13p-item ul { margin: 0 0 1.5mm; padding-right: 5mm; }
      .pc13p-item li { margin: 0.6mm 0; }
      .pc13p-item li small { color: #444; }
      .pc13p-danger { font-weight: 700; }
      .pc13p-muted { color: #666; }
      .pc13p-notes { border: 1px solid #999; padding: 1.5mm 3mm; min-height: 12mm; }
      .pc13p-notes p { margin: 1mm 0 0; white-space: pre-wrap; }
      .pc13p-foot { margin-top: 6mm; border-top: 1px solid #000; padding-top: 3mm; }
      .pc13p-sign { display: flex; justify-content: space-around; margin-top: 12mm; }
      @page { size: A4; margin: 12mm; }
    }
  `],
})
export class Pc13MinutesComponent {
  @Input() doc: MinutesDoc | null = null;
  readonly faInt = faInt;
}
