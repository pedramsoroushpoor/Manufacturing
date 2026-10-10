import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type GraphNodeKind = 'sequential' | 'parallel' | 'buffer';
export type GraphEdgeKind = 'main' | 'rework' | 'bypass';

export interface GraphNode {
  id: number;
  code: string;
  label: string;
  sublabel: string;
  kind: GraphNodeKind;
  active: boolean;
  /** فقط برای چیدمان خودکار: ترتیب پیش‌فرض گره‌های هم‌سطح. */
  seq: number;
  /** مختصات مکانی صریح (نقشه‌ی کارخانه). اگر همه‌ی گره‌ها x و y داشته باشند
   *  چیدمان خودکار کنار گذاشته می‌شود و همین مختصات رسم می‌شود. */
  x?: number;
  y?: number;
}

export interface GraphEdge {
  from: number;
  to: number;
  kind: GraphEdgeKind;
  active: boolean;
  note?: string;
}

interface PlacedNode extends GraphNode {
  px: number;
  py: number;
  shortSublabel: string;
}

interface PlacedEdge {
  d: string;
  cls: string;
  marker: string;
  title: string;
}

const NODE_W = 140;
const NODE_H = 66;
const GAP_X = 46;
const GAP_Y = 18;
const PAD = 16;
const REWORK_DROP = 34;
/** کمترین مقیاسی که نمودار برای جا شدن در پهنای صفحه می‌پذیرد. */
const MIN_SCALE = 0.75;

let instanceCounter = 0;

/**
 * رسم «گراف توپولوژی» یک خط تولید با SVG.
 *
 * ورودی فقط گره و یال است، نه یک فهرست مرتب — پس انشعاب، ادغام، مسیر
 * برگشت (دوباره‌کاری) و مسیر غیرفعال‌شده قابل نمایش است.
 *
 * دو حالت چیدمان:
 *  ۱) خودکار (پیش‌فرض): گره‌ها بر اساس یال‌های رو‌به‌جلو لایه‌بندی می‌شوند
 *     (طولانی‌ترین مسیر از مبدأ) و از راست به چپ رسم می‌شوند.
 *  ۲) مکانی: اگر همه‌ی گره‌ها x/y داشته باشند همان مختصات رسم می‌شود. این
 *     همان نقطه‌ی اتصال «نقشه‌ی کارخانه» در آینده است — تصویر پس‌زمینه،
 *     بزرگ‌نمایی و جابه‌جایی روی همین SVG اضافه می‌شود، بدون تغییر ورودی.
 */
@Component({
  selector: 'gng-topology-graph',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="topo" *ngIf="placed.length; else empty">
      <svg
        [attr.viewBox]="'0 0 ' + width + ' ' + height"
        [style.max-width.px]="width"
        [style.min-width.px]="width * minScale"
        role="img"
      >
        <defs>
          <marker [attr.id]="uid + '-main'" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" class="topo-arrow topo-arrow--main" />
          </marker>
          <marker [attr.id]="uid + '-rework'" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" class="topo-arrow topo-arrow--rework" />
          </marker>
          <marker [attr.id]="uid + '-off'" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" class="topo-arrow topo-arrow--off" />
          </marker>
        </defs>

        <path *ngFor="let e of placedEdges" [attr.d]="e.d" [attr.class]="e.cls" [attr.marker-end]="'url(#' + uid + '-' + e.marker + ')'">
          <title *ngIf="e.title">{{ e.title }}</title>
        </path>

        <g
          *ngFor="let n of placed"
          [attr.transform]="'translate(' + n.px + ',' + n.py + ')'"
          [attr.class]="nodeClass(n)"
          (click)="nodeClick.emit(n.id)"
        >
          <title>{{ n.code }} — {{ n.label }}{{ n.sublabel ? ' (' + n.sublabel + ')' : '' }}{{ n.active ? '' : ' — غیرفعال' }}</title>
          <rect class="topo-node__box" [attr.width]="nodeW" [attr.height]="nodeH" rx="8" ry="8" />
          <rect class="topo-node__pill" [attr.x]="nodeW / 2 - 22" y="7" width="44" height="17" rx="8.5" ry="8.5" />
          <text class="topo-node__code" [attr.x]="nodeW / 2" y="19.5">{{ n.code }}</text>
          <text class="topo-node__label" [attr.x]="nodeW / 2" y="41">{{ n.label }}</text>
          <text class="topo-node__sub" [attr.x]="nodeW / 2" y="57">{{ n.shortSublabel }}</text>
        </g>
      </svg>
    </div>
    <ng-template #empty>
      <p class="topo-empty">برای این خط هنوز ایستگاهی تعریف نشده است.</p>
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .topo {
        overflow-x: auto;
        padding: 0.2rem 0;
      }
      /* نمودار تا حد «minScale» کوچک می‌شود تا در پهنای موجود جا شود؛ اگر باز
         هم جا نشد، اسکرول افقی می‌خورد تا نوشته‌ها ناخوانا نشوند. */
      svg {
        display: block;
        width: 100%;
        height: auto;
        font-family: var(--gng-font);
      }
      .topo-empty {
        margin: 0;
        padding: 0.8rem 0.4rem;
        font-size: 0.8rem;
        color: var(--gng-text-muted);
      }

      .topo-edge {
        fill: none;
        stroke: var(--gng-text-muted);
        stroke-width: 1.5;
      }
      .topo-edge--rework {
        stroke: var(--gng-danger);
        stroke-dasharray: 5 4;
      }
      .topo-edge--bypass {
        stroke-dasharray: 2 4;
      }
      .topo-edge--off {
        stroke: var(--gng-border);
        stroke-dasharray: 4 4;
      }
      .topo-arrow--main {
        fill: var(--gng-text-muted);
      }
      .topo-arrow--rework {
        fill: var(--gng-danger);
      }
      .topo-arrow--off {
        fill: var(--gng-border);
      }

      .topo-node {
        cursor: pointer;
      }
      .topo-node__box {
        fill: rgba(46, 134, 222, 0.07);
        stroke: rgba(46, 134, 222, 0.45);
        stroke-width: 1;
      }
      .topo-node__pill {
        fill: var(--gng-info);
      }
      .topo-node--parallel .topo-node__box {
        fill: rgba(39, 174, 96, 0.08);
        stroke: rgba(39, 174, 96, 0.5);
      }
      .topo-node--parallel .topo-node__pill {
        fill: var(--gng-success);
      }
      .topo-node--buffer .topo-node__box {
        fill: rgba(242, 177, 52, 0.1);
        stroke: rgba(242, 177, 52, 0.7);
        stroke-dasharray: 5 3;
      }
      .topo-node--buffer .topo-node__pill {
        fill: var(--gng-warning);
      }
      .topo-node--off {
        opacity: 0.5;
      }
      .topo-node--off .topo-node__box {
        stroke-dasharray: 3 3;
      }
      .topo-node:hover .topo-node__box,
      .topo-node--selected .topo-node__box {
        stroke: var(--gng-primary);
        stroke-width: 2;
      }
      .topo-node__code {
        fill: #fff;
        font-size: 10.5px;
        font-weight: 700;
        text-anchor: middle;
      }
      .topo-node__label {
        fill: var(--gng-text);
        font-size: 13px;
        font-weight: 600;
        text-anchor: middle;
      }
      .topo-node__sub {
        fill: var(--gng-text-muted);
        font-size: 11px;
        text-anchor: middle;
      }
    `,
  ],
})
export class TopologyGraphComponent implements OnChanges {
  @Input() nodes: GraphNode[] = [];
  @Input() edges: GraphEdge[] = [];
  /** گره‌ای که باید برجسته شود (مثلاً ایستگاه انتخاب‌شده در درخت). */
  @Input() selectedId: number | null = null;
  @Output() nodeClick = new EventEmitter<number>();

  readonly uid = `gng-topo-${++instanceCounter}`;
  readonly nodeW = NODE_W;
  readonly nodeH = NODE_H;
  readonly minScale = MIN_SCALE;

  placed: PlacedNode[] = [];
  placedEdges: PlacedEdge[] = [];
  width = 0;
  height = 0;

  ngOnChanges(): void {
    this.layout();
  }

  nodeClass(n: PlacedNode): string {
    return [
      'topo-node',
      `topo-node--${n.kind}`,
      n.active ? '' : 'topo-node--off',
      n.id === this.selectedId ? 'topo-node--selected' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  private layout(): void {
    const nodes = this.nodes ?? [];
    const ids = new Set(nodes.map((n) => n.id));
    const edges = (this.edges ?? []).filter((e) => ids.has(e.from) && ids.has(e.to));
    if (!nodes.length) {
      this.placed = [];
      this.placedEdges = [];
      this.width = this.height = 0;
      return;
    }

    const explicit = nodes.every((n) => typeof n.x === 'number' && typeof n.y === 'number');
    const layerOf = explicit ? new Map<number, number>() : this.computeLayers(nodes, edges);

    const hasRework = edges.some((e) => e.kind === 'rework');
    const hasSkip =
      !explicit && edges.some((e) => e.kind !== 'rework' && Math.abs(layerOf.get(e.to)! - layerOf.get(e.from)!) > 1);
    const topExtra = hasSkip ? Math.round(NODE_H * 0.45) : 0;

    const pos = new Map<number, { x: number; y: number }>();
    if (explicit) {
      for (const n of nodes) pos.set(n.id, { x: n.x!, y: n.y! });
      const maxX = Math.max(...nodes.map((n) => n.x!));
      const maxY = Math.max(...nodes.map((n) => n.y!));
      this.width = maxX + NODE_W + PAD;
      this.height = maxY + NODE_H + PAD + (hasRework ? REWORK_DROP : 0);
    } else {
      const byLayer = new Map<number, GraphNode[]>();
      for (const n of nodes) {
        const l = layerOf.get(n.id)!;
        if (!byLayer.has(l)) byLayer.set(l, []);
        byLayer.get(l)!.push(n);
      }
      const layerCount = Math.max(...byLayer.keys()) + 1;
      const maxRows = Math.max(...[...byLayer.values()].map((v) => v.length));
      this.width = PAD * 2 + layerCount * NODE_W + (layerCount - 1) * GAP_X;
      const bodyH = maxRows * NODE_H + (maxRows - 1) * GAP_Y;
      this.height = PAD * 2 + topExtra + bodyH + (hasRework ? REWORK_DROP : 0);

      for (const [l, group] of byLayer) {
        group.sort((a, b) => a.seq - b.seq || a.code.localeCompare(b.code));
        const groupH = group.length * NODE_H + (group.length - 1) * GAP_Y;
        const top = PAD + topExtra + (bodyH - groupH) / 2;
        // راست‌به‌چپ: لایه‌ی صفر (مبدأ جریان) در سمت راست قرار می‌گیرد.
        const x = this.width - PAD - NODE_W - l * (NODE_W + GAP_X);
        group.forEach((n, i) => pos.set(n.id, { x, y: top + i * (NODE_H + GAP_Y) }));
      }
    }

    this.placed = nodes.map((n) => ({
      ...n,
      px: pos.get(n.id)!.x,
      py: pos.get(n.id)!.y,
      shortSublabel: n.sublabel.length > 22 ? n.sublabel.slice(0, 21) + '…' : n.sublabel,
    }));

    const bottom = Math.max(...this.placed.map((n) => n.py + NODE_H));
    this.placedEdges = edges.map((e) => {
      const a = pos.get(e.from)!;
      const b = pos.get(e.to)!;
      const off = !e.active;
      let d: string;
      if (e.kind === 'rework') {
        // مسیر برگشت: از زیر گره‌ی مبدأ، با قوسی پایین‌تر از همه‌ی گره‌ها.
        const sx = a.x + NODE_W / 2;
        const tx = b.x + NODE_W / 2;
        const yb = bottom + REWORK_DROP;
        d = `M ${sx} ${a.y + NODE_H} C ${sx} ${yb}, ${tx} ${yb}, ${tx} ${b.y + NODE_H}`;
      } else {
        // جهت واقعی از روی موقعیت گره‌ها تشخیص داده می‌شود تا در حالت مکانی هم درست باشد.
        const leftward = b.x <= a.x;
        const sx = leftward ? a.x : a.x + NODE_W;
        const tx = leftward ? b.x + NODE_W : b.x;
        const sy = a.y + NODE_H / 2;
        const ty = b.y + NODE_H / 2;
        const skips = !explicit && Math.abs(layerOf.get(e.to)! - layerOf.get(e.from)!) > 1;
        if (skips) {
          // یالی که از روی یک یا چند لایه می‌پرد از بالای گره‌های میانی عبور می‌کند.
          const yt = Math.min(sy, ty) - NODE_H;
          const dx = leftward ? -GAP_X : GAP_X;
          d = `M ${sx} ${sy} C ${sx + dx} ${yt}, ${tx - dx} ${yt}, ${tx} ${ty}`;
        } else {
          const mid = (sx + tx) / 2;
          d = `M ${sx} ${sy} C ${mid} ${sy}, ${mid} ${ty}, ${tx} ${ty}`;
        }
      }
      return {
        d,
        cls: ['topo-edge', `topo-edge--${e.kind}`, off ? 'topo-edge--off' : ''].filter(Boolean).join(' '),
        marker: off ? 'off' : e.kind === 'rework' ? 'rework' : 'main',
        title: e.note ?? '',
      };
    });
  }

  /** لایه‌ی هر گره = طول طولانی‌ترین مسیر رو‌به‌جلو تا آن گره. یال‌های
   *  دوباره‌کاری در لایه‌بندی شرکت نمی‌کنند (وگرنه حلقه می‌سازند). */
  private computeLayers(nodes: GraphNode[], edges: GraphEdge[]): Map<number, number> {
    const layer = new Map<number, number>(nodes.map((n) => [n.id, 0]));
    const forward = edges.filter((e) => e.kind !== 'rework');

    if (!forward.length) {
      // بدون هیچ اتصال: همان ترتیب قدیمی بر اساس SequenceNo.
      const seqs = [...new Set(nodes.map((n) => n.seq))].sort((a, b) => a - b);
      for (const n of nodes) layer.set(n.id, seqs.indexOf(n.seq));
      return layer;
    }

    // حداکثر به تعداد گره‌ها تکرار؛ اگر داده حلقه‌ی رو‌به‌جلو داشته باشد همین‌جا متوقف می‌شود.
    for (let i = 0; i < nodes.length; i++) {
      let changed = false;
      for (const e of forward) {
        const want = layer.get(e.from)! + 1;
        if (want > layer.get(e.to)! && want < nodes.length) {
          layer.set(e.to, want);
          changed = true;
        }
      }
      if (!changed) break;
    }

    // گره‌ی بدون هیچ اتصال رو‌به‌جلو بعد از آخرین لایه قرار می‌گیرد تا روی بقیه نیفتد.
    const touched = new Set<number>();
    for (const e of forward) {
      touched.add(e.from);
      touched.add(e.to);
    }
    let next = Math.max(...layer.values()) + 1;
    for (const n of [...nodes].sort((a, b) => a.seq - b.seq)) {
      if (!touched.has(n.id)) layer.set(n.id, next++);
    }
    return layer;
  }
}
