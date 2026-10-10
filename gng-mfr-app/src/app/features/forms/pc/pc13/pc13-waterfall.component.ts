import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WaterStep } from '../frm-pc-13.data';

interface Bar { label: string; text: string; hint: string; kind: string; bottom: number; height: number }

/** آبشار «چرا برنامه محقق نشد؟» — از راست به چپ: برنامه ← کسرها ← خروجی سالم (ساعت استاندارد). */
@Component({
  selector: 'gng-pc13-waterfall',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wf" [class.wf--big]="big">
      <div class="wf__col" *ngFor="let b of bars" [title]="b.hint">
        <div class="wf__plot">
          <div class="wf__bar" [ngClass]="'wf__bar--' + b.kind" [style.bottom.%]="b.bottom" [style.height.%]="b.height">
            <span class="wf__txt">{{ b.text }}</span>
          </div>
        </div>
        <div class="wf__lbl">{{ b.label }}</div>
      </div>
    </div>
  `,
  styles: [`
    .wf { display: flex; gap: 0.35rem; align-items: stretch; height: 11rem; direction: rtl; }
    .wf--big { height: 19rem; }
    .wf__col { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .wf__plot { position: relative; flex: 1; border-bottom: 1px solid rgba(255,255,255,0.2); }
    .wf__bar { position: absolute; left: 12%; right: 12%; border-radius: 3px; min-height: 2px; }
    .wf__bar--total { background: #74c0fc; }
    .wf__bar--loss { background: repeating-linear-gradient(135deg, #ff6b6b 0 6px, #e03131 6px 12px); }
    .wf__bar--result { background: #3ddc84; }
    .wf__txt { position: absolute; top: -1.15rem; left: 0; right: 0; text-align: center; font-size: 0.7rem; color: #e9eef4; font-weight: 700; white-space: nowrap; }
    .wf--big .wf__txt { font-size: 1.05rem; top: -1.6rem; }
    .wf__lbl { font-size: 0.66rem; color: #9fb0c2; text-align: center; margin-top: 0.3rem; line-height: 1.25; min-height: 1.7rem; }
    .wf--big .wf__lbl { font-size: 0.95rem; }
  `],
})
export class Pc13WaterfallComponent implements OnChanges {
  @Input() steps: WaterStep[] = [];
  @Input() big = false;
  bars: Bar[] = [];

  ngOnChanges(): void {
    const max = Math.max(1e-9, ...this.steps.map((s) => (s.kind === 'loss' ? s.base + s.value : s.value)));
    this.bars = this.steps.map((s) => ({
      label: s.label, text: s.text, hint: s.hint, kind: s.kind, bottom: s.kind === 'loss' ? (s.base / max) * 88 : 0, height: (s.value / max) * 88,
    }));
  }
}
