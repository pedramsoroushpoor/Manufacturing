import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { XNode } from './pe10-engine';
import { faNum } from '../../pc/pc-shared';

export type Overlay = 'risk' | 'stock' | 'single' | 'noSub' | 'quality' | 'ai' | 'customer';
interface Cell { key: string; x: number; y: number; w: number; h: number; fill: string; code: string; qty: string; tip: string; productId: number; cycle: boolean; showText: boolean }

const COL = 180;
const ROW = 22;

/**
 * پرتونگاری ساختار به شکل «آیسیکل» راست‌به‌چپ: ستون راست ریشه (خود ساختار)، هر ستون یک سطح بسط؛ ارتفاع هر گره
 * متناسب با شمار برگ‌های زیرش. رنگ = لایه‌ی خطر انتخاب‌شده.
 */
@Component({
  selector: 'gng-pe10-icicle',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ic">
      <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" [style.min-width.px]="width" role="img" aria-label="پرتونگاری ساختار">
        <g>
          <rect [attr.x]="width - COL + 2" y="1" [attr.width]="COL - 6" [attr.height]="height - 2" class="ic__root" rx="4"></rect>
          <text [attr.x]="width - 10" [attr.y]="height / 2 - 6" text-anchor="start" direction="rtl" class="ic__rt">{{ rootLabel }}</text>
          <text [attr.x]="width - 10" [attr.y]="height / 2 + 12" text-anchor="start" direction="rtl" class="ic__rq">{{ rootQty }}</text>
        </g>
        <g *ngFor="let c of cells; trackBy: byKey" class="ic__c" (click)="pick.emit(c.productId)">
          <rect [attr.x]="c.x" [attr.y]="c.y" [attr.width]="c.w" [attr.height]="c.h" [attr.fill]="c.fill" rx="3" [class.ic__cyc]="c.cycle"><title>{{ c.tip }}</title></rect>
          <text *ngIf="c.showText" [attr.x]="c.x + c.w - 6" [attr.y]="c.y + c.h / 2 - (c.h >= 34 ? 4 : -4)" text-anchor="start" direction="rtl" class="ic__t">{{ c.code }}</text>
          <text *ngIf="c.showText && c.h >= 34" [attr.x]="c.x + c.w - 6" [attr.y]="c.y + c.h / 2 + 11" text-anchor="start" direction="rtl" class="ic__q">{{ c.qty }}</text>
        </g>
      </svg>
    </div>
  `,
  styles: [`
    .ic { overflow-x: auto; }
    .ic svg { display: block; width: 100%; }
    .ic__root { fill: rgba(255, 207, 90, 0.16); stroke: #ffcf5a; stroke-width: 1; }
    .ic__rt { fill: #ffe7a8; font-size: 13px; font-weight: 800; }
    .ic__rq { fill: #dbe9ff; font-size: 11px; }
    .ic__c { cursor: pointer; }
    .ic__c rect { stroke: rgba(11, 30, 52, 0.9); stroke-width: 1.2; }
    .ic__c:hover rect { stroke: #fff; }
    .ic__cyc { stroke: #ff6b6b !important; stroke-dasharray: 4 2; }
    .ic__t { fill: #071a2e; font-size: 10.5px; font-weight: 800; font-family: monospace; pointer-events: none; }
    .ic__q { fill: #0b2440; font-size: 10px; pointer-events: none; }
  `],
})
export class Pe10IcicleComponent implements OnChanges {
  @Input() nodes: XNode[] = [];
  @Input() overlay: Overlay = 'risk';
  @Input() rootLabel = '';
  @Input() rootQty = '';
  @Output() pick = new EventEmitter<number>();

  readonly COL = COL;
  cells: Cell[] = [];
  width = COL * 3;
  height = 300;

  ngOnChanges(): void {
    const kids = new Map<string, XNode[]>();
    for (const n of this.nodes) kids.set(n.parentKey, [...(kids.get(n.parentKey) ?? []), n]);
    const leaves = new Map<string, number>();
    const count = (key: string): number => {
      const ch = kids.get(key) ?? [];
      const v = ch.length ? ch.reduce((a, c) => a + count(c.key), 0) : 1;
      leaves.set(key, v);
      return v;
    };
    const total = Math.max(1, (kids.get('') ?? []).reduce((a, c) => a + count(c.key), 0));
    const depth = Math.max(1, ...this.nodes.map((n) => n.level));
    this.width = COL * (depth + 1);
    this.height = Math.max(260, total * ROW);
    const unit = this.height / total;
    const cells: Cell[] = [];
    const place = (parent: string, y0: number): void => {
      let y = y0;
      for (const n of kids.get(parent) ?? []) {
        const h = (leaves.get(n.key) ?? 1) * unit;
        const x = this.width - COL * (n.level + 1);
        cells.push({
          key: n.key, x: x + 2, y: y + 1, w: COL - 6, h: Math.max(2, h - 2), fill: this.fill(n), code: n.code, productId: n.productId, cycle: n.cycle,
          qty: n.req === null ? (n.note || '—') : `${faNum(n.req, n.req >= 100 ? 0 : 3)} ${n.unit}`, showText: h >= 15,
          tip: `${n.code} ${n.title}${n.req !== null ? ' — ' + faNum(n.req, 3) + ' ' + n.unit : ''}${n.note ? ' (' + n.note + ')' : ''}${n.child ? ' · ساختار ' + n.child : ''}${n.phantom ? ' · فانتوم' : ''}${n.subGroup ? ' · گروه جایگزین ' + n.subGroup : ''}${n.cycle ? ' · حلقه‌ی بازگشتی!' : ''}${this.flagText(n)}`,
        });
        place(n.key, y);
        y += h;
      }
    };
    place('', 0);
    this.cells = cells;
  }

  private flagText(n: XNode): string {
    const f = n.flags;
    const t: string[] = [];
    if (f.stock === 2) t.push('موجودی کمتر از نیاز');
    else if (f.stock === 1) t.push('موجودی کمتر از دو برابر نیاز');
    if (f.single) t.push('تک‌منبع');
    if (f.noSub) t.push('بدون جایگزین');
    if (f.quality) t.push('قرنطینه/مردود/انقضای نزدیک');
    if (f.ai) t.push('ماده‌ی مؤثره');
    if (f.customer) t.push('موجودی امانی مشتری');
    return t.length ? ' · ' + t.join('، ') : '';
  }

  private fill(n: XNode): string {
    const ok = '#7fd1ae';
    const warn = '#ffcf5a';
    const bad = '#ff8a7a';
    const na = '#9fb6cf';
    const f = n.flags;
    switch (this.overlay) {
      case 'stock': return f.stock === 2 ? bad : f.stock === 1 ? warn : ok;
      case 'single': return f.single ? bad : ok;
      case 'noSub': return f.noSub ? bad : n.subGroup ? ok : na;
      case 'quality': return f.quality ? warn : ok;
      case 'ai': return f.ai ? '#c9a7ff' : na;
      case 'customer': return f.customer ? '#7cc4ff' : na;
      default: return n.risk >= 4 ? bad : n.risk >= 2 ? warn : n.risk >= 1 ? '#d8e88a' : ok;
    }
  }

  byKey(_: number, c: Cell): string {
    return c.key;
  }
}
