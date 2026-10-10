import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Link, Op } from '../frm-me-11.data';

interface FNode { id: number; x: number; y: number; seq: string; title: string; sev: number; orphan: boolean; out: boolean; tip: string }
interface FEdge { d: string; back: boolean; implicit: boolean; label: string; lx: number; ly: number }

/**
 * گراف کوچک روش ساخت (راست‌به‌چپ): ستون = عمق مسیر پیشرو، رنگ گره = بدترین نقص عملیات.
 * یال برگشتی (حلقه) قرمز خط‌چین، عملیات یتیم با حاشیه‌ی خط‌چین در ستون آخر، روش بی‌یال با ترتیب ضمنی.
 */
@Component({
  selector: 'gng-me11-flow',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg class="fl" [attr.viewBox]="'0 0 ' + w + ' ' + h" [style.height.px]="compact ? null : h" preserveAspectRatio="xMidYMid meet" role="img">
      <defs>
        <marker [attr.id]="mk" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L8,4 L0,8 z" class="fl__arrow"></path>
        </marker>
      </defs>
      <path *ngFor="let e of edges" [attr.d]="e.d" class="fl__edge" [class.fl__edge--back]="e.back" [class.fl__edge--imp]="e.implicit" [attr.marker-end]="'url(#' + mk + ')'"></path>
      <ng-container *ngIf="!compact">
        <text *ngFor="let e of edges" [attr.x]="e.lx" [attr.y]="e.ly" class="fl__share" text-anchor="middle">{{ e.label }}</text>
      </ng-container>
      <g *ngFor="let n of nodes" class="fl__node" [ngClass]="'fl__node--s' + n.sev" [class.fl__node--orphan]="n.orphan" [class.fl__node--on]="n.id === selected"
        (click)="pick.emit(n.id)">
        <title>{{ n.tip }}</title>
        <rect [attr.x]="n.x - nw / 2" [attr.y]="n.y - nh / 2" [attr.width]="nw" [attr.height]="nh" [attr.rx]="compact ? 3 : 6"></rect>
        <text [attr.x]="n.x" [attr.y]="compact ? n.y + 3 : n.y - 3" text-anchor="middle" class="fl__seq">{{ n.seq }}</text>
        <text *ngIf="!compact" [attr.x]="n.x" [attr.y]="n.y + 11" text-anchor="middle" direction="rtl" class="fl__t">{{ n.title }}</text>
        <circle *ngIf="n.out" [attr.cx]="n.x + nw / 2 - 4" [attr.cy]="n.y - nh / 2 + 4" r="2.5" class="fl__out"></circle>
      </g>
    </svg>
  `,
  styles: [`
    :host { display: block; }
    .fl { width: 100%; display: block; }
    .fl__edge { fill: none; stroke: #7fb8e6; stroke-width: 1.3; opacity: 0.85; }
    .fl__edge--back { stroke: #ff6b6b; stroke-dasharray: 4 3; stroke-width: 1.6; }
    .fl__edge--imp { stroke-dasharray: 2 3; opacity: 0.5; }
    .fl__arrow { fill: #7fb8e6; }
    .fl__share { font-size: 8px; fill: #a9d1f5; }
    .fl__node { cursor: pointer; }
    .fl__node rect { fill: #0f3a63; stroke: #5fb4ff; stroke-width: 1.2; }
    .fl__node--s1 rect { stroke: #ffd166; }
    .fl__node--s2 rect { stroke: #ff9f43; fill: #3f2d12; }
    .fl__node--s3 rect { stroke: #ff5d5d; fill: #4a1720; stroke-width: 1.8; }
    .fl__node--orphan rect { stroke-dasharray: 3 2; }
    .fl__node--on rect { stroke: #fff; stroke-width: 2.4; }
    .fl__node:hover rect { filter: brightness(1.3); }
    .fl__seq { font-size: 9px; font-weight: 700; fill: #e6f3ff; font-family: monospace; }
    .fl__t { font-size: 8px; fill: #bcd9f2; }
    .fl__out { fill: #7ee2a8; }
  `],
})
export class Me11FlowComponent implements OnChanges {
  @Input() ops: Op[] = [];
  @Input() links: Link[] = [];
  @Input() sev: Record<number, number> = {};
  @Input() compact = false;
  @Input() selected: number | null = null;
  @Output() pick = new EventEmitter<number>();

  private static seqId = 0;
  readonly mk = `me11mk${++Me11FlowComponent.seqId}`;
  nodes: FNode[] = [];
  edges: FEdge[] = [];
  w = 100;
  h = 40;
  nw = 18;
  nh = 14;

  ngOnChanges(): void {
    const colW = this.compact ? 26 : 92;
    const rowH = this.compact ? 20 : 46;
    this.nw = this.compact ? 18 : 78;
    this.nh = this.compact ? 13 : 32;
    const ops = [...this.ops].sort((a, b) => a.seq - b.seq);
    const ids = new Set(ops.map((o) => o.id));
    const links = this.links.filter((l) => ids.has(l.from) && ids.has(l.to));
    const seqOf = new Map(ops.map((o) => [o.id, o.seq]));
    const implicit = !links.length && ops.length > 1;
    const fwd = implicit
      ? ops.slice(1).map((o, i) => ({ from: ops[i].id, to: o.id, share: null as number | null }))
      : links.filter((l) => (seqOf.get(l.to) ?? 0) > (seqOf.get(l.from) ?? 0));
    const back = implicit ? [] : links.filter((l) => (seqOf.get(l.to) ?? 0) <= (seqOf.get(l.from) ?? 0));
    const touched = new Set<number>();
    for (const l of [...fwd, ...back]) {
      touched.add(l.from);
      touched.add(l.to);
    }
    const depth = new Map<number, number>();
    for (const o of ops) {
      if (!touched.has(o.id) && !implicit && ops.length > 1) continue;
      const preds = fwd.filter((l) => l.to === o.id).map((l) => (depth.get(l.from) ?? 0) + 1);
      depth.set(o.id, Math.max(0, ...preds));
    }
    const maxD = Math.max(0, ...depth.values());
    const orphans = ops.filter((o) => !depth.has(o.id));
    orphans.forEach((o) => depth.set(o.id, maxD + 1));
    const cols = new Map<number, number[]>();
    for (const o of ops) cols.set(depth.get(o.id) ?? 0, [...(cols.get(depth.get(o.id) ?? 0) ?? []), o.id]);
    const nCols = Math.max(...cols.keys(), 0) + 1;
    const nRows = Math.max(1, ...[...cols.values()].map((c) => c.length));
    const pad = this.compact ? 12 : 50;
    this.w = pad * 2 + (nCols - 1) * colW;
    const topM = back.length ? (this.compact ? 9 : 26) : 0;
    const body = (this.compact ? 10 : 24) * 2 + (nRows - 1) * rowH;
    this.h = body + topM;
    const pos = new Map<number, { x: number; y: number }>();
    for (const [d, list] of cols)
      list.forEach((id, i) => pos.set(id, { x: this.w - pad - d * colW, y: topM + body / 2 + (i - (list.length - 1) / 2) * rowH }));
    const orphanSet = new Set(orphans.map((o) => o.id));
    this.nodes = ops.map((o) => {
      const p = pos.get(o.id) ?? { x: 0, y: 0 };
      const sev = this.sev[o.id] ?? 0;
      return {
        id: o.id, x: p.x, y: p.y, seq: String(o.seq), title: o.title.length > 14 ? o.title.slice(0, 13) + '…' : o.title, sev, orphan: orphanSet.has(o.id),
        out: o.outCount > 0, tip: `${o.seq} — ${o.title}${o.resTitle ? ' · ' + o.resTitle : ' · بی‌منبع'}${o.outsourced ? ' · برون‌سپاری' : ''}`,
      };
    });
    const half = this.nw / 2;
    this.edges = [
      ...fwd.map((l) => {
        const a = pos.get(l.from) as { x: number; y: number };
        const c = pos.get(l.to) as { x: number; y: number };
        const x1 = a.x - half;
        const x2 = c.x + half;
        const mx = (x1 + x2) / 2;
        return { d: `M${x1},${a.y} C${mx},${a.y} ${mx},${c.y} ${x2},${c.y}`, back: false, implicit, label: l.share ? `${l.share}٪` : '', lx: mx, ly: (a.y + c.y) / 2 - 3 };
      }),
      ...back.map((l) => {
        const a = pos.get(l.from) as { x: number; y: number };
        const c = pos.get(l.to) as { x: number; y: number };
        const top = Math.max(1, Math.min(a.y, c.y) - this.nh / 2 - topM);
        return { d: `M${a.x},${a.y - this.nh / 2} C${a.x},${top} ${c.x},${top} ${c.x},${c.y - this.nh / 2}`, back: true, implicit: false, label: 'حلقه', lx: (a.x + c.x) / 2, ly: top + 4 };
      }),
    ];
  }
}
