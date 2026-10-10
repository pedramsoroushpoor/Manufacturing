import { Component, ElementRef, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { TooltipModule } from 'primeng/tooltip';
import { OperationalFormLayoutComponent, BannerTone } from '../../../shared/operational-form-layout/operational-form-layout.component';
import { DataSourceBadgeComponent, DataSourceInfo } from '../../../shared/data-source-badge/data-source-badge.component';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { DECISION_STATUS, NC_TYPE, PRIORITY, WO_STATUS, WO_TYPE, faInt, faNum, faPct } from './pc-shared';
import {
  AREA_COLOR, AREA_LABEL, AgendaItem, DAY, DnaRow, Fact, ForecastRow, HEAT_METRICS, HOUR, HeatCell, HeatDay, HeatMetric, HeatRow, IMPACT_FORMULA, KIND_LABEL, KpiTile,
  LineTile, M6_LABEL, MIN, MinutesDoc, Pc13Bundle, Problem, ProblemGroup, RiskPoint, Scope, WHATIF_FORMULA, WaterStep, WhatIfParams, WhatIfRow, dayKey, dayStart,
  faDM, faDMT, faHM, faHours, faMoney, faRange, parseDay, shortLine,
} from './frm-pc-13.data';
import { FrmPc13Service } from './frm-pc-13.service';
import { BASE_WHATIF, Ctx, KpiCalc, NOW, Pc13Engine, distinctByOrder } from './pc13/pc13-engine';
import { Pc13DeckComponent } from './pc13/pc13-deck.component';
import { Pc13DnaComponent } from './pc13/pc13-dna.component';
import { Pc13HeatmapComponent } from './pc13/pc13-heatmap.component';
import { JourneyView, Pc13JourneyComponent } from './pc13/pc13-journey.component';
import { Pc13MinutesComponent } from './pc13/pc13-minutes.component';
import { Pc13RadarComponent } from './pc13/pc13-radar.component';
import { Pc13RiskComponent } from './pc13/pc13-risk.component';
import { Pc13TimelineComponent } from './pc13/pc13-timeline.component';
import { Pc13WaterfallComponent } from './pc13/pc13-waterfall.component';

type Space = 'week' | 'scen' | 'radar' | 'journey' | 'agenda';
const CUR_FROM = Date.UTC(2026, 9, 3);
const LOAD_FROM = '2026-09-26';
const LOAD_TO = '2026-10-09';
const HEAT_COLOR: Record<HeatMetric, string> = { prod: '#22c1c3', stop: '#ff5d5d', waste: '#ff9f43', copq: '#b57cff', reports: '#4dabf7' };

/**
 * FRM-PC-13 — «اتاق جلسه‌ی کنترل تولید» (BI سناریومحور برای جلسه‌ی هفتگی پایان هفته).
 *
 * یک «دامنه»ی مشترک (هفته/بازه، یک سفارش یا همه، خط، نوع دستور، مشتری) و یک «ماشین زمان» (هد پخش روی جریان
 * رویداد با بازپخش) همه‌ی فضاها را می‌رانند: تصویر هفته (کاشی‌ها با مقایسه‌ی هفته‌ی قبل، نقشه‌ی حرارتی خط×روز،
 * DNA سفارش‌ها)، سناریوها (آبشار برنامه، ماتریس خطر، هزینه‌ی کیفیت، مواد، بیرون از کارخانه، شبیه‌ساز «اگر…»)،
 * رادار مشکلات با امتیاز اثر، مسیر سفارش (خطوط شنا + روایت خودکار)، دستور جلسه‌ی خودکار با یادداشت محلی و چاپ
 * صورت‌جلسه، و حالت ارائه‌ی تمام‌صفحه.
 *
 * فاز اول: فقط‌خواندنی، همه‌چیز از /api/pc13/bundle مشتق می‌شود. ارسال صورت‌جلسه به مشارکان، ثبت تصمیم/اقدام در
 * سامانه، زمان‌بندی جلسه و مقایسه‌ی هفته‌های دلخواه بیرون از بازه‌ی داده با فاز ایجاد/ویرایش می‌آید.
 */
@Component({
  selector: 'gng-frm-pc-13',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ButtonModule, DropdownModule, TooltipModule, OperationalFormLayoutComponent, DataSourceBadgeComponent, Pc13TimelineComponent,
    Pc13HeatmapComponent, Pc13DnaComponent, Pc13WaterfallComponent, Pc13RiskComponent, Pc13RadarComponent, Pc13JourneyComponent, Pc13MinutesComponent, Pc13DeckComponent,
  ],
  templateUrl: './frm-pc-13.component.html',
  styles: [`
    .wr { --w-bg: var(--gng-dark-900); --w-p: var(--gng-dark-800); --w-p2: var(--gng-dark-700); --w-line: var(--gng-dark-border); --w-text: #e9eef4; --w-mut: #9fb0c2;
      background: var(--w-bg); color: var(--w-text); border-radius: var(--gng-radius); padding: 0.9rem; display: flex; flex-direction: column; gap: 0.8rem; min-height: 30rem; }
    .wr__state { padding: 2rem; text-align: center; color: var(--w-mut); }
    .wr__state--err { color: #ff8787; }
    .wr__scope { background: var(--w-p); border: 1px solid var(--w-line); border-radius: var(--gng-radius); padding: 0.6rem 0.75rem; display: flex; flex-direction: column; gap: 0.45rem; }
    .wr__row { display: flex; flex-wrap: wrap; gap: 0.5rem 1.1rem; align-items: center; }
    .seg { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; }
    .seg--grow { flex: 1 1 18rem; min-width: 14rem; }
    .seg--sm .chip { padding: 0.12rem 0.55rem; font-size: 0.7rem; }
    .chip { background: rgba(255,255,255,0.05); color: var(--w-text); border: 1px solid var(--w-line); border-radius: 99px; padding: 0.2rem 0.7rem; font-size: 0.76rem; cursor: pointer; font-family: inherit; white-space: nowrap; }
    .chip:hover { border-color: var(--gng-primary-light); }
    .chip--on { background: var(--gng-primary); border-color: var(--gng-primary); color: #1a1205; font-weight: 700; }
    .chip--static { cursor: default; }
    .chip--ghost { background: none; color: var(--w-mut); }
    .wr__date { background: var(--w-p2); color: var(--w-text); border: 1px solid var(--w-line); border-radius: 6px; padding: 0.15rem 0.35rem; font-family: inherit; font-size: 0.74rem; color-scheme: dark; }
    .wr__dim { color: var(--w-mut); font-size: 0.72rem; }
    .wr__crumb { font-size: 0.95rem; font-weight: 700; color: var(--gng-primary-light); }
    .wr__crumb i { margin-left: 0.3rem; }
    .wr__tm { position: relative; background: var(--w-p); border: 1px solid var(--w-line); border-radius: var(--gng-radius); padding: 0.55rem 0.75rem; }
    .wr__rail { display: flex; gap: 0.35rem; flex-wrap: wrap; border-bottom: 1px solid var(--w-line); padding-bottom: 0.4rem; }
    .wr__rail button { background: none; border: none; color: var(--w-mut); font-family: inherit; font-size: 0.86rem; padding: 0.45rem 0.85rem; border-radius: 8px 8px 0 0; cursor: pointer; display: flex; gap: 0.35rem; align-items: center; }
    .wr__rail button:hover { color: var(--w-text); }
    .wr__rail button.on { color: #fff; background: var(--w-p); box-shadow: inset 0 -3px 0 var(--gng-primary); font-weight: 700; }
    .wr__rail b { background: rgba(255,255,255,0.1); border-radius: 99px; padding: 0 0.45rem; font-size: 0.7rem; }
    .wr__rail b.hot { background: #c92a2a; color: #fff; }
    .wr__rail-gap { flex: 1; }
    .wr__rail .present { background: rgba(155,89,182,0.25); color: #e5d4ff; border-radius: 8px; }
    .wr__todo { margin: 0; }
    .sp { display: flex; flex-direction: column; gap: 0.8rem; }
    .panel { position: relative; background: var(--w-p); border: 1px solid var(--w-line); border-radius: var(--gng-radius); padding: 0.75rem 0.9rem; }
    .panel h3, .panel__h h3 { margin: 0 0 0.5rem; font-size: 0.95rem; color: #fff; }
    .panel h3 small { color: var(--w-mut); font-weight: 400; font-size: 0.72rem; }
    .panel__h { display: flex; justify-content: space-between; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
    .panel__h h3 { margin: 0; }
    .hint { font-size: 0.7rem; color: var(--w-mut); margin-top: 0.45rem; line-height: 1.6; }
    .empty { color: var(--w-mut); font-size: 0.8rem; padding: 0.6rem 0; }
    .mono { font-family: monospace; }
    .tiles { position: relative; display: grid; grid-template-columns: repeat(auto-fit, minmax(11.5rem, 1fr)); gap: 0.6rem; }
    .tile { background: var(--w-p); border: 1px solid var(--w-line); border-radius: var(--gng-radius); padding: 0.65rem 0.8rem; border-top: 3px solid var(--gng-info); }
    .tile--success { border-top-color: #3ddc84; } .tile--warning { border-top-color: #ffb547; } .tile--danger { border-top-color: #ff5d5d; } .tile--info { border-top-color: #4dabf7; }
    .tile__l { font-size: 0.74rem; color: var(--w-mut); }
    .tile__v { font-size: 1.75rem; font-weight: 800; line-height: 1.2; color: #fff; font-variant-numeric: tabular-nums; }
    .tile__v small { font-size: 0.7rem; font-weight: 400; color: var(--w-mut); }
    .tile__s { font-size: 0.7rem; color: #cfd8e3; min-height: 1rem; }
    .tile__d { font-size: 0.72rem; margin-top: 0.2rem; color: var(--w-mut); }
    .tile__d span { color: var(--w-mut); }
    .tile__d--good { color: #3ddc84; } .tile__d--bad { color: #ff8787; }
    .ltiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: 0.6rem; }
    .ltile { display: flex; gap: 0.8rem; align-items: center; background: var(--w-p); border: 1px solid var(--w-line); border-radius: var(--gng-radius); padding: 0.55rem 0.75rem; cursor: pointer; }
    .ltile:hover { border-color: var(--gng-primary-light); }
    .ring { width: 3.6rem; height: 3.6rem; border-radius: 50%; display: grid; place-items: center; flex: none; }
    .ring span { width: 2.8rem; height: 2.8rem; border-radius: 50%; background: var(--w-p); display: grid; place-items: center; font-size: 0.74rem; font-weight: 800; }
    .ltile__n { font-weight: 800; }
    .ltile__v { font-size: 1.1rem; font-weight: 800; }
    .ltile__v small { font-size: 0.66rem; color: var(--w-mut); font-weight: 400; }
    .ltile__s { font-size: 0.68rem; color: var(--w-mut); }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(24rem, 1fr)); gap: 0.8rem; }
    .card { position: relative; background: var(--w-p); border: 1px solid var(--w-line); border-radius: var(--gng-radius); padding: 0.8rem 0.95rem; display: flex; flex-direction: column; gap: 0.45rem; min-width: 0; }
    .card--wide { grid-column: 1 / -1; }
    .card__q { font-size: 1.02rem; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 0.45rem; }
    .card__q small { color: var(--w-mut); font-weight: 400; font-size: 0.72rem; cursor: help; margin-right: auto; }
    .card__tag { background: var(--gng-primary); color: #1a1205; border-radius: 6px; padding: 0 0.45rem; font-size: 0.8rem; }
    .card__story { margin: 0.2rem 0 0; font-size: 0.8rem; line-height: 1.75; color: #dbe4ee; background: rgba(255,255,255,0.03); border-right: 3px solid var(--gng-primary); padding: 0.4rem 0.6rem; border-radius: 4px; }
    .card__drill { align-self: flex-start; background: none; border: 1px dashed var(--w-line); color: var(--w-mut); border-radius: 6px; padding: 0.15rem 0.6rem; font-family: inherit; font-size: 0.72rem; cursor: pointer; }
    .card__drill:hover { color: #fff; border-color: var(--gng-primary-light); }
    .mini { width: 100%; border-collapse: collapse; font-size: 0.72rem; }
    .mini th { text-align: right; color: var(--w-mut); font-weight: 400; border-bottom: 1px solid var(--w-line); padding: 0.2rem 0.3rem; }
    .mini td { padding: 0.22rem 0.3rem; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .mini tr.late td { color: #ff8787; }
    .mini tr.hot td { background: rgba(255,181,71,0.06); }
    .mini tr.flip-good td { background: rgba(61,220,132,0.1); }
    .mini tr.flip-bad td { background: rgba(255,93,93,0.12); }
    .click { cursor: pointer; }
    .click:hover td, li.click:hover { background: rgba(255,255,255,0.05); }
    .bar { display: inline-block; width: 4rem; height: 5px; background: rgba(255,255,255,0.1); border-radius: 9px; overflow: hidden; vertical-align: middle; }
    .bar i { display: block; height: 100%; background: #4dabf7; }
    .bar--wide { width: 100%; }
    .bar--ok i { background: #3ddc84; }
    .hbars { display: flex; flex-direction: column; gap: 0.25rem; }
    .hbar { display: grid; grid-template-columns: 9.5rem 1fr 6.5rem; gap: 0.4rem; align-items: center; font-size: 0.7rem; }
    .hbar__k { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #cfd8e3; }
    .hbar__t { position: relative; height: 0.8rem; background: rgba(255,255,255,0.05); border-radius: 3px; }
    .hbar__t i { position: absolute; top: 0; bottom: 0; right: 0; background: rgba(181,124,255,0.45); border-radius: 3px; }
    .hbar__t em { position: absolute; top: 3px; bottom: 3px; right: 0; background: #b57cff; border-radius: 3px; }
    .hbar__v { text-align: left; color: var(--w-mut); }
    .trend { display: flex; gap: 3px; height: 3.4rem; align-items: flex-end; }
    .trend__c { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; }
    .trend__c i { width: 70%; background: #b57cff; border-radius: 2px 2px 0 0; min-height: 1px; }
    .trend__c span { font-size: 0.55rem; color: var(--w-mut); white-space: nowrap; }
    .trend__c--nd i { background: repeating-linear-gradient(135deg, #b57cff 0 3px, transparent 3px 6px); }
    .kv { display: flex; flex-wrap: wrap; gap: 0.3rem 1rem; font-size: 0.74rem; color: var(--w-mut); }
    .kv b { color: #fff; }
    .kv--hot, .kv--hot b { color: #ffb547; }
    .sub { font-size: 0.72rem; color: var(--gng-primary-light); margin-top: 0.3rem; border-bottom: 1px dashed var(--w-line); }
    .item { font-size: 0.74rem; padding: 0.2rem 0.35rem; border-radius: 4px; cursor: pointer; color: #dbe4ee; }
    .item:hover { background: rgba(255,255,255,0.05); }
    .item--hot { border-right: 3px solid #ff5d5d; background: rgba(255,93,93,0.06); }
    .item small { color: var(--w-mut); }
    .up { color: #ff8787; } .down { color: #ffd43b; }
    .pill { display: inline-block; font-size: 0.64rem; padding: 0 0.4rem; border-radius: 99px; background: rgba(255,255,255,0.08); color: #cfd8e3; margin-right: 0.3rem; }
    .pill--warn { background: rgba(255,212,59,0.15); color: #ffd43b; }
    .pill--hot { background: rgba(255,93,93,0.2); color: #ffa8a8; }
    .ext { display: flex; flex-direction: column; gap: 0.3rem; }
    .ext__h { font-size: 0.82rem; }
    .ext__bar { display: grid; grid-template-columns: 6rem 1fr 3rem; gap: 0.4rem; align-items: center; font-size: 0.7rem; color: var(--w-mut); }
    .ctr { display: flex; flex-direction: column; font-size: 0.66rem; color: var(--w-mut); border-right: 2px solid #4dabf7; padding-right: 0.5rem; }
    .wi { display: grid; grid-template-columns: minmax(16rem, 22rem) 1fr; gap: 1.2rem; }
    .wi__ctl { display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.76rem; }
    .wi__row { display: flex; flex-direction: column; gap: 0.15rem; }
    .wi__row input[type='range'] { width: 100%; accent-color: var(--gng-primary); direction: ltr; }
    .wi__chk { display: flex; gap: 0.35rem; align-items: center; font-size: 0.74rem; cursor: pointer; }
    .wi__chk input { accent-color: var(--gng-primary); }
    .wi__chips { display: flex; gap: 0.4rem; margin-bottom: 0.4rem; }
    .dchip { display: inline-block; border-radius: 99px; padding: 0.05rem 0.5rem; font-size: 0.7rem; background: rgba(255,255,255,0.08); }
    .dchip--good { background: rgba(61,220,132,0.18); color: #69f0ae; }
    .dchip--bad { background: rgba(255,93,93,0.2); color: #ffa8a8; }
    @media (max-width: 900px) { .wi { grid-template-columns: 1fr; } }
    .radar { display: grid; grid-template-columns: minmax(18rem, 30rem) 1fr; gap: 0.8rem; align-items: start; }
    @media (max-width: 1100px) { .radar { grid-template-columns: 1fr; } }
    .legend { display: flex; flex-wrap: wrap; gap: 0.6rem; font-size: 0.68rem; color: var(--w-mut); justify-content: center; }
    .legend i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-left: 4px; }
    .grp { margin-bottom: 0.6rem; }
    .grp__h { font-weight: 800; font-size: 0.82rem; border-bottom: 1px solid var(--w-line); padding: 0.2rem 0; margin-bottom: 0.2rem; }
    .grp__h span { color: var(--w-mut); font-weight: 400; font-size: 0.7rem; }
    .prob { display: grid; grid-template-columns: 2.4rem 1fr auto 8rem; gap: 0.5rem; align-items: center; padding: 0.3rem 0.35rem; border-radius: 6px; cursor: pointer; font-size: 0.76rem; border-right: 3px solid #4dabf7; }
    .prob:hover { background: rgba(255,255,255,0.04); }
    .prob--danger { border-right-color: #ff5d5d; } .prob--warning { border-right-color: #ffb547; }
    .prob--on { background: rgba(247,148,29,0.12); }
    .prob__score { font-weight: 900; font-size: 0.95rem; text-align: center; color: #fff; background: rgba(255,255,255,0.07); border-radius: 6px; }
    .prob__tag { font-size: 0.62rem; border: 1px solid; border-radius: 99px; padding: 0 0.4rem; color: #cfd8e3; white-space: nowrap; }
    .prob__o { font-size: 0.66rem; color: var(--w-mut); }
    .prob__x { margin: 0.2rem 2.9rem 0.6rem 0; padding: 0.5rem 0.7rem; background: rgba(0,0,0,0.25); border-radius: 8px; font-size: 0.76rem; display: flex; flex-direction: column; gap: 0.3rem; }
    .prob__x p { margin: 0; line-height: 1.7; }
    .prob__dec { color: #ffd8a8; }
    .prob__meta { font-size: 0.66rem; color: var(--w-mut); }
    .ev { font-size: 0.7rem; color: #cfd8e3; }
    .ev__k { display: inline-block; min-width: 5rem; color: var(--gng-primary-light); }
    .ev small { color: var(--w-mut); }
    .jhead { display: flex; flex-wrap: wrap; gap: 0.6rem 1.2rem; align-items: center; }
    .jhead__id { display: flex; flex-direction: column; }
    .jhead__id b { font-size: 1.3rem; color: var(--gng-primary-light); }
    .jhead__id span { font-size: 0.8rem; color: #cfd8e3; }
    .jhead .kv { flex: 1; }
    .cols2 { display: grid; grid-template-columns: 1.5fr 1fr; gap: 0.8rem; }
    @media (max-width: 1000px) { .cols2 { grid-template-columns: 1fr; } }
    .story p { margin: 0 0 0.4rem; font-size: 0.82rem; line-height: 1.85; color: #dbe4ee; }
    .hotgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 0.6rem; }
    .hotcard { background: var(--w-p2); border: 1px solid var(--w-line); border-radius: 10px; padding: 0.6rem 0.75rem; color: var(--w-text); text-align: right; cursor: pointer; font-family: inherit; display: flex; flex-direction: column; gap: 0.15rem; }
    .hotcard:hover { border-color: var(--gng-primary); }
    .hotcard b { color: var(--gng-primary-light); }
    .hotcard span { font-size: 0.78rem; }
    .hotcard em { font-style: normal; font-size: 0.7rem; color: #ffb547; }
    .hotcard small { font-size: 0.66rem; color: var(--w-mut); }
    .agh { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .agh h3 { margin: 0; }
    .draft { border: 1px dashed #ffd43b; color: #ffd43b; border-radius: 6px; padding: 0 0.4rem; margin-right: 0.4rem; }
    .ag { display: grid; grid-template-columns: 3rem 1fr; gap: 0.7rem; background: var(--w-p); border: 1px solid var(--w-line); border-radius: var(--gng-radius); padding: 0.7rem 0.9rem; }
    .ag__no { font-size: 1.8rem; font-weight: 900; color: var(--gng-primary); text-align: center; }
    .ag__h { display: flex; gap: 0.6rem; align-items: center; font-size: 0.95rem; }
    .ag ul { margin: 0.35rem 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0.2rem; }
    .ag li { font-size: 0.8rem; padding: 0.2rem 0.5rem; border-right: 3px solid #4dabf7; border-radius: 3px; }
    .ag li small { display: block; color: var(--w-mut); font-size: 0.68rem; }
    .ln--danger { border-right-color: #ff5d5d !important; } .ln--warning { border-right-color: #ffb547 !important; } .ln--success { border-right-color: #3ddc84 !important; }
    .ln--muted { border-right-color: #5c7080 !important; color: var(--w-mut); }
    .ag__note { width: 100%; background: rgba(0,0,0,0.25); color: var(--w-text); border: 1px solid var(--w-line); border-radius: 6px; padding: 0.35rem 0.5rem; font-family: inherit; font-size: 0.78rem; resize: vertical; }
    .ag__note:focus { outline: none; border-color: var(--gng-primary); }
    :host ::ng-deep .wr__dd.p-dropdown { background: var(--gng-dark-700); border-color: var(--gng-dark-border); }
    :host ::ng-deep .wr__dd .p-dropdown-label { color: #e9eef4; font-size: 0.8rem; padding: 0.3rem 0.6rem; }
  `],
})
export class FrmPc13Component implements OnInit, OnDestroy {
  readonly companyId = DEMO_COMPANY_ID;
  loading = false;
  loadFailed = false;
  data: Pc13Bundle | null = null;
  eng: Pc13Engine | null = null;
  private loadedFrom = Date.parse(`${LOAD_FROM}T00:00:00Z`);
  private loadedTo = Date.parse(`${LOAD_TO}T00:00:00Z`) + DAY;

  // ───────── دامنه ─────────
  scope: Scope = { from: CUR_FROM, to: CUR_FROM + 7 * DAY, mode: 'range', woId: null, lines: [], types: [], customer: null };
  weekMode: 'cur' | 'prev' | 'custom' = 'cur';
  customFrom = dayKey(CUR_FROM);
  customTo = dayKey(CUR_FROM + 6 * DAY);
  private stack: { scope: Scope; week: 'cur' | 'prev' | 'custom' }[] = [];
  ctx: Ctx | null = null;
  breadcrumb = '';
  rangeLabel = '';
  orderOptions: { label: string; value: number }[] = [];
  typeChips: { code: number; label: string }[] = [];
  lineChips: { id: number; label: string }[] = [];
  customers: string[] = [];

  // ───────── ماشین زمان ─────────
  t = NOW;
  tMax = NOW;
  playing = false;
  isPast = false;
  tLabel = '';
  playX = 100;
  density: { x: number; w: number; h: number[] }[] = [];
  dayMarks: { x: number; label: string }[] = [];
  private replay: ReturnType<typeof setInterval> | null = null;
  private seekTimer: ReturnType<typeof setTimeout> | null = null;

  // ───────── فضاها ─────────
  space: Space = 'week';
  tiles: KpiTile[] = [];
  lineTiles: LineTile[] = [];
  private kpiPrev: KpiCalc | null = null;
  kpiCur: KpiCalc | null = null;
  heatMetric: HeatMetric = 'stop';
  heatDays: HeatDay[] = [];
  heatRows: HeatRow[] = [];
  dnaRows: DnaRow[] = [];

  steps: WaterStep[] = [];
  wfNarrative = '';
  wfOrders: { id: number; wo: string; title: string; std: string; progress: number; status: string }[] = [];
  base: ForecastRow[] = [];
  lateCount = 0;
  risk: RiskPoint[] = [];
  riskNarrative = '';
  copqBy: 'reason' | 'line' | 'type' = 'reason';
  copq: ReturnType<Pc13Engine['copq']> | null = null;
  mat: ReturnType<Pc13Engine['materials']> | null = null;
  out: ReturnType<Pc13Engine['outside']> | null = null;
  drill: string | null = null;

  wi: WhatIfParams = { ...BASE_WHATIF, rates: {}, extraShift: {} };
  wiRows: WhatIfRow[] = [];
  wiNarrative = '';
  wiSaved = 0;
  wiBroken = 0;

  problems: Problem[] = [];
  topProblems: Problem[] = [];
  groups: ProblemGroup[] = [];
  groupBy: 'area' | 'line' | 'order' | 'owner' = 'area';
  selKey: string | null = null;
  sel: Problem | null = null;

  focus: Fact | null = null;
  journey: JourneyView | null = null;
  story: string[] = [];
  related: ReturnType<Pc13Engine['related']> | null = null;
  focusForecast: ForecastRow | null = null;
  hotOrders: { id: number; wo: string; title: string; score: number; count: number; top: string }[] = [];

  agenda: AgendaItem[] = [];
  agendaMinutes = 0;
  notes: Record<string, string> = {};
  minutesDoc: MinutesDoc | null = null;
  deckOpen = false;

  bannerText = 'در حال خواندن…';
  bannerTone: BannerTone = 'info';
  contextLabel = '';

  readonly heatMetrics = HEAT_METRICS;
  readonly groupsLegend = (Object.keys(AREA_LABEL) as (keyof typeof AREA_LABEL)[]).map((a) => ({ label: AREA_LABEL[a], color: AREA_COLOR[a] }));
  readonly impactFormula = IMPACT_FORMULA;
  readonly whatIfFormula = WHATIF_FORMULA;
  readonly areaLabel = AREA_LABEL;
  readonly areaColor = AREA_COLOR;
  readonly m6Label = M6_LABEL;
  readonly kindLabel = KIND_LABEL;
  readonly ncType = NC_TYPE;
  readonly decisionStatus = DECISION_STATUS;
  readonly woStatus = WO_STATUS;
  readonly woType = WO_TYPE;
  readonly priority = PRIORITY;
  readonly faInt = faInt;
  readonly faNum = faNum;
  readonly faPct = faPct;
  readonly faDM = faDM;
  readonly faDMT = faDMT;
  readonly faHM = faHM;
  readonly faHours = faHours;
  readonly faMoney = faMoney;
  readonly shortLine = shortLine;
  readonly now = NOW;
  readonly dsFacts = this.ds('pc13-facts', 'واقعیت‌های دستور');
  readonly dsEvents = this.ds('pc13-events', 'جریان رویداد');
  readonly dsDaily = this.ds('pc13-daily', 'جمع روزانه‌ی خط');
  readonly dsAlerts = this.ds('pc12-exceptions', 'موتور استثنا');
  readonly dsCopq = this.ds('pc09-copq', 'هزینه‌ی کیفیت');
  readonly dsVariance = this.ds('pc06-variance', 'انحراف مصرف');

  constructor(private svc: FrmPc13Service, private host: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    this.load(LOAD_FROM, LOAD_TO);
  }

  ngOnDestroy(): void {
    this.pause();
    if (this.seekTimer) clearTimeout(this.seekTimer);
  }

  private load(from: string, to: string): void {
    this.loading = true;
    this.svc.bundle(from, to, this.companyId).subscribe({
      next: (b) => {
        this.data = b;
        this.eng = new Pc13Engine(b);
        this.loadedFrom = parseDay(from) ?? this.loadedFrom;
        this.loadedTo = (parseDay(to) ?? this.loadedTo - DAY) + DAY;
        this.loading = false;
        this.loadFailed = false;
        this.orderOptions = [...b.facts].sort((x, y) => x.wo.localeCompare(y.wo)).map((f) => ({ label: `${f.wo} — ${f.title} (${WO_STATUS[f.status] ?? ''})`, value: f.id }));
        this.typeChips = this.eng.types.map((c) => ({ code: c, label: WO_TYPE[c] ?? String(c) }));
        this.lineChips = this.eng.lines.map((l) => ({ id: l.id, label: l.short }));
        this.customers = this.eng.customers;
        this.recomputeScope(true);
      },
      error: (err) => {
        console.warn('[FRM-PC-13] خواندن داده ناموفق بود:', err?.message || err);
        this.loading = false;
        this.loadFailed = true;
        this.bannerText = 'خواندن داده از gng-mfr-api ناموفق بود. اجرای mes_frm_pc13_setup.sql و endpoint ‎/api/pc13/bundle را بررسی کنید.';
        this.bannerTone = 'danger';
      },
    });
  }

  // ───────── فرمان‌های دامنه ─────────

  setWeek(w: 'cur' | 'prev'): void {
    this.weekMode = w;
    const from = w === 'cur' ? CUR_FROM : CUR_FROM - 7 * DAY;
    this.scope = { ...this.scope, from, to: from + 7 * DAY };
    this.customFrom = dayKey(from);
    this.customTo = dayKey(from + 6 * DAY);
    this.recomputeScope(true);
  }

  applyCustom(): void {
    const a = parseDay(this.customFrom);
    const b = parseDay(this.customTo);
    if (a === null || b === null || b < a || b - a > 61 * DAY) return;
    this.weekMode = 'custom';
    this.scope = { ...this.scope, from: a, to: b + DAY };
    const span = b + DAY - a;
    if (a - span < this.loadedFrom || b + DAY > this.loadedTo) {
      this.load(dayKey(Math.min(a - span, this.loadedFrom)), dayKey(Math.max(b, this.loadedTo - DAY)));
      return;
    }
    this.recomputeScope(true);
  }

  setMode(m: 'range' | 'order'): void {
    if (m === 'order') {
      const id = this.scope.woId ?? this.problems.find((p) => p.woId !== null)?.woId ?? this.orderOptions[0]?.value ?? null;
      this.scope = { ...this.scope, mode: 'order', woId: id };
    } else this.scope = { ...this.scope, mode: 'range' };
    this.recomputeScope(false);
  }

  focusOrder(id: number | null, jump = true): void {
    if (id === null) return;
    this.scope = { ...this.scope, mode: 'order', woId: id };
    if (jump) this.space = 'journey';
    this.recomputeScope(false);
  }

  toggleLine(id: number): void {
    const l = this.scope.lines.includes(id) ? this.scope.lines.filter((x) => x !== id) : [...this.scope.lines, id];
    this.scope = { ...this.scope, lines: l };
    this.recomputeScope(false);
  }

  toggleType(code: number): void {
    const l = this.scope.types.includes(code) ? this.scope.types.filter((x) => x !== code) : [...this.scope.types, code];
    this.scope = { ...this.scope, types: l };
    this.recomputeScope(false);
  }

  setCustomer(c: string | null): void {
    this.scope = { ...this.scope, customer: this.scope.customer === c ? null : c };
    this.recomputeScope(false);
  }

  clearFilters(): void {
    this.scope = { ...this.scope, lines: [], types: [], customer: null, mode: 'range' };
    this.recomputeScope(false);
  }

  pickCell(c: HeatCell): void {
    this.stack.push({ scope: this.scope, week: this.weekMode });
    this.weekMode = 'custom';
    this.customFrom = dayKey(c.day);
    this.customTo = dayKey(c.day);
    this.scope = { ...this.scope, from: c.day, to: c.day + DAY, lines: [c.lineId], mode: 'range' };
    this.recomputeScope(true);
  }

  get canBack(): boolean {
    return this.stack.length > 0;
  }

  back(): void {
    const p = this.stack.pop();
    if (!p) return;
    this.scope = p.scope;
    this.weekMode = p.week;
    this.customFrom = dayKey(p.scope.from);
    this.customTo = dayKey(p.scope.to - DAY);
    this.recomputeScope(true);
  }

  // ───────── ماشین زمان ─────────

  seek(v: number): void {
    this.t = Math.max(this.scope.from, Math.min(this.tMax, v));
    // کشیدن هد پخش: حداکثر هر ۴۰ میلی‌ثانیه یک بازمحاسبه
    if (!this.seekTimer)
      this.seekTimer = setTimeout(() => {
        this.seekTimer = null;
        this.recomputeTime();
      }, 40);
  }

  play(): void {
    if (this.playing) return;
    if (this.t >= this.tMax) this.t = this.scope.from;
    this.playing = true;
    this.replay = setInterval(() => {
      this.t = Math.min(this.tMax, this.t + HOUR);
      this.recomputeTime();
      if (this.t >= this.tMax) this.pause();
    }, 250);
  }

  pause(): void {
    this.playing = false;
    if (this.replay) clearInterval(this.replay);
    this.replay = null;
  }

  stopReplay(): void {
    this.pause();
    this.t = this.scope.from;
    this.recomputeTime();
  }

  goNow(): void {
    this.pause();
    this.t = this.tMax;
    this.recomputeTime();
  }

  // ───────── محاسبه ─────────

  /** تغییر دامنه: همه‌ی چیزهایی که به لحظه وابسته نیستند */
  private recomputeScope(resetT: boolean): void {
    const e = this.eng;
    if (!e) return;
    const s = this.scope;
    const c = e.ctx(s);
    this.ctx = c;
    this.tMax = Math.max(s.from, Math.min(s.to - MIN, NOW));
    if (resetT || this.t > this.tMax || this.t < s.from) this.t = this.tMax;
    const span = s.to - s.from;
    this.density = e.density(c);
    this.dayMarks = [];
    for (let d = dayStart(s.from); d < s.to && this.dayMarks.length < 62; d += DAY) this.dayMarks.push({ x: ((d - s.from) / span) * 100, label: faDM(d) });
    this.kpiPrev = s.mode === 'order' ? null : e.kpi(e.ctx({ ...s, from: s.from - span, to: s.from }), s.from - span, s.from - 1);
    this.copq = e.copq(c, this.copqBy);
    this.mat = e.materials(c);
    this.out = e.outside(c);
    this.base = e.forecast(c, BASE_WHATIF);
    this.risk = e.risk(this.base);
    const late = this.base.filter((r) => r.late).sort((a, b) => a.slackH - b.slackH);
    this.lateCount = late.length;
    this.riskNarrative = this.base.length
      ? `${faInt(this.base.length)} دستور فعال در دامنه؛ ${late.length ? `${faInt(late.length)} دستور طبق مدل پس از سررسید تمام می‌شوند — بدترین ${late[0].wo} با ${faHours(-late[0].slackH)} تأخیر (${late[0].reasons.slice(-1)[0] ?? ''}).` : 'همه پیش از سررسید تمام می‌شوند.'} ${this.base.filter((r) => !r.late && r.slackH < 12).length ? faInt(this.base.filter((r) => !r.late && r.slackH < 12).length) + ' دستور کمتر از ۱۲ ساعت حاشیه دارند.' : ''}`
      : 'دستور فعالی در دامنه نیست.';
    this.recomputeWhatIf();
    this.rangeLabel = faRange(s.from, s.to);
    const lines = s.lines.length ? s.lines.map((id) => e.lines.find((l) => l.id === id)?.short ?? '').join('، ') : 'همه‌ی خطوط';
    const types = s.types.length ? `دستورهای ${s.types.map((x) => WO_TYPE[x]).join(' و ')}` : 'همه‌ی انواع دستور';
    const order = s.mode === 'order' && s.woId !== null ? `${e.byId.get(s.woId)?.wo ?? ''} · ` : '';
    this.breadcrumb = `${order}${lines} · ${types}${s.customer ? ' · ' + s.customer : ''} · ${this.rangeLabel}`;
    this.focus = s.mode === 'order' && s.woId !== null ? e.byId.get(s.woId) ?? null : null;
    this.related = this.focus ? e.related(this.focus) : null;
    this.focusForecast = this.focus ? this.base.find((r) => r.id === this.focus?.id) ?? null : null;
    this.loadNotes();
    this.recomputeTime();
  }

  /** تغییر لحظه‌ی t: وضعیت در زمان */
  private recomputeTime(): void {
    const e = this.eng;
    const c = this.ctx;
    if (!e || !c) return;
    const s = this.scope;
    const t = this.t;
    this.isPast = t < NOW - MIN;
    this.tLabel = this.isPast ? `ساعت ${faDM(t)} ${faHM(t)} — گذشته را می‌بینید` : `اکنون · ${faDMT(t)}`;
    this.playX = Math.max(0, Math.min(100, ((t - s.from) / Math.max(1, s.to - s.from)) * 100));
    this.kpiCur = e.kpi(c, s.from, t);
    this.problems = e.problems(c, t, this.base);
    this.groups = e.groupProblems(this.problems, this.groupBy);
    this.topProblems = distinctByOrder(this.problems, 5);
    this.sel = this.selKey ? this.problems.find((p) => p.key === this.selKey) ?? null : null;
    this.tiles = e.tiles(this.kpiCur, this.kpiPrev, this.isPast ? null : this.lateCount, this.problems, t);
    this.lineTiles = e.lineTiles(this.kpiCur, c);
    this.recomputeHeat();
    this.dnaRows = e.dna(c, t);
    const wf = e.waterfall(c, t);
    this.steps = wf.steps;
    this.wfNarrative = wf.narrative;
    this.wfOrders = c.orders
      .filter((f) => f.status !== 6 && f.planComplete !== null && f.planComplete >= s.from && f.planComplete < s.to)
      .map((f) => ({ id: f.id, wo: f.wo, title: f.title, std: faNum(f.stdMin / 60, 1), progress: Math.round(e.progressAt(f, t) * 100), status: WO_STATUS[f.status] ?? '' }));
    this.agenda = e.agenda(c, this.kpiCur, wf, this.problems, this.base);
    this.agendaMinutes = this.agenda.reduce((a, it) => a + it.minutes, 0);
    const byWo = new Map<number, Problem[]>();
    for (const p of this.problems) if (p.woId !== null) byWo.set(p.woId, [...(byWo.get(p.woId) ?? []), p]);
    this.hotOrders = [...byWo.entries()]
      .map(([id, ps]) => ({ id, wo: ps[0].wo, title: e.byId.get(id)?.title ?? '', score: ps.reduce((a, p) => a + p.score, 0), count: ps.length, top: ps[0].title }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
    if (this.focus) {
      const j = e.journey(this.focus, t);
      this.journey = j;
      this.story = e.story(this.focus, t, this.focusForecast ?? undefined);
    } else {
      this.journey = null;
      this.story = [];
    }
    this.buildMinutes();
    const top = (s.mode === 'order' ? this.problems : this.topProblems).slice(0, 3);
    this.bannerText = top.length
      ? `${this.isPast ? `در ${faDMT(t)}: ` : ''}${top.map((p, i) => `${faInt(i + 1)}) ${p.title}`).join('   ')}`
      : 'در این دامنه مشکل بازی دیده نمی‌شود.';
    this.bannerTone = top.some((p) => p.sev >= 3) ? 'danger' : top.length ? 'warning' : 'success';
    this.contextLabel = `${this.rangeLabel} · ${this.isPast ? faDMT(t) : 'اکنون'}`;
  }

  recomputeHeat(): void {
    if (!this.eng || !this.ctx) return;
    const h = this.eng.heat(this.ctx, this.heatMetric, this.t);
    this.heatDays = h.days;
    this.heatRows = h.rows;
  }

  setHeat(m: HeatMetric): void {
    this.heatMetric = m;
    this.recomputeHeat();
  }

  get heatColor(): string {
    return HEAT_COLOR[this.heatMetric];
  }

  setCopqBy(g: 'reason' | 'line' | 'type'): void {
    this.copqBy = g;
    if (this.eng && this.ctx) this.copq = this.eng.copq(this.ctx, g);
  }

  setGroup(g: 'area' | 'line' | 'order' | 'owner'): void {
    this.groupBy = g;
    if (this.eng) this.groups = this.eng.groupProblems(this.problems, g);
  }

  pickProblem(key: string): void {
    this.selKey = this.selKey === key ? null : key;
    this.sel = this.selKey ? this.problems.find((p) => p.key === key) ?? null : null;
  }

  toggleDrill(k: string): void {
    this.drill = this.drill === k ? null : k;
  }

  // ───────── «اگر…» ─────────

  recomputeWhatIf(): void {
    if (!this.eng || !this.ctx) return;
    const scen = this.eng.forecast(this.ctx, this.wi);
    this.wiRows = this.eng.whatIfRows(this.base, scen);
    this.wiSaved = this.wiRows.filter((r) => r.flip === 'saved').length;
    this.wiBroken = this.wiRows.filter((r) => r.flip === 'broken').length;
    const lateN = this.wiRows.filter((r) => r.lateAfter).length;
    const gain = this.wiRows.reduce((a, r) => a + Math.min(0, r.deltaH), 0);
    this.wiNarrative = `در این سناریو ${faInt(lateN)} دستور دیر می‌رسد (پایه: ${faInt(this.base.filter((r) => r.late).length)}). ${this.wiSaved ? faInt(this.wiSaved) + ' دستور از «دیر» به «به‌موقع» می‌رود. ' : ''}${this.wiBroken ? faInt(this.wiBroken) + ' دستور از «به‌موقع» به «دیر» می‌افتد. ' : ''}${gain < -0.05 ? `جمع زمان جلوافتاده ${faHours(-gain)}.` : ''}`;
  }

  setRate(lineId: number, v: number): void {
    this.wi = { ...this.wi, rates: { ...this.wi.rates, [lineId]: Number(v) } };
    this.recomputeWhatIf();
  }

  setShift(lineId: number, v: boolean): void {
    this.wi = { ...this.wi, extraShift: { ...this.wi.extraShift, [lineId]: v } };
    this.recomputeWhatIf();
  }

  setWi(patch: Partial<WhatIfParams>): void {
    this.wi = { ...this.wi, ...patch };
    this.recomputeWhatIf();
  }

  resetWi(): void {
    this.wi = { ...BASE_WHATIF, rates: {}, extraShift: {} };
    this.recomputeWhatIf();
  }

  // ───────── یادداشت‌های جلسه (فقط localStorage) ─────────

  private get notesKey(): string {
    return `gng-mfr.pc13.minutes.${dayKey(this.scope.from)}`;
  }

  private loadNotes(): void {
    try {
      const raw = localStorage.getItem(this.notesKey);
      const v: unknown = raw ? JSON.parse(raw) : {};
      this.notes = v && typeof v === 'object' ? (v as Record<string, string>) : {};
    } catch {
      this.notes = {};
    }
  }

  setNote(id: string, text: string): void {
    this.notes = { ...this.notes, [id]: text };
    try {
      localStorage.setItem(this.notesKey, JSON.stringify(this.notes));
    } catch {
      /* ذخیره‌ی محلی در دسترس نیست — یادداشت فقط در همین نشست می‌ماند */
    }
    this.buildMinutes();
  }

  private buildMinutes(): void {
    this.minutesDoc = {
      title: 'صورت‌جلسه‌ی کنترل تولید', scope: this.breadcrumb, date: faDMT(NOW), items: this.agenda, notes: this.notes,
      owners: [...new Set(this.problems.slice(0, 8).map((p) => p.owner).filter((o) => !!o))],
    };
  }

  printMinutes(): void {
    const src = this.host.nativeElement.querySelector('.pc13p-root');
    if (!src) return;
    const wrap = document.createElement('div');
    wrap.className = 'pc13p-host';
    wrap.appendChild(src.cloneNode(true));
    document.body.appendChild(wrap);
    document.body.classList.add('pc13-printing');
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      wrap.remove();
      document.body.classList.remove('pc13-printing');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    try {
      window.print();
    } finally {
      setTimeout(cleanup, 500);
    }
  }

  present(): void {
    this.pause();
    this.deckOpen = true;
  }

  ds(key: string, label: string): DataSourceInfo {
    return { key, label, filterVal: this.companyId };
  }

  severityTone(sev: number): string {
    return sev >= 3 ? 'danger' : sev === 2 ? 'warning' : 'info';
  }

  trackKey(_: number, p: Problem): string {
    return p.key;
  }

  trackId(_: number, x: { id: number }): number {
    return x.id;
  }
}
