import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { OperationalFormLayoutComponent, BannerTone } from '../../../shared/operational-form-layout/operational-form-layout.component';
import { DataSourceBadgeComponent, DataSourceInfo } from '../../../shared/data-source-badge/data-source-badge.component';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { SHOP_NOW, faDay, faInt, faNum, faPct } from '../pc/pc-shared';
import {
  CALIB_FORMULA, CAT_LABEL, CovProduct, DEBT_FORMULA, Defect, HEALTH_FORMULA, Line, Me11Bundle, NATURE, Op, ORDER_TYPE, QUAL_STATUS, ROUTING_STATUS, Routing,
  SEV_LABEL, SIM_FORMULA, Subcontract, Tone,
} from './frm-me-11.data';
import { FrmMe11Service } from './frm-me-11.service';
import {
  Band, CalResult, CalRow, ContractorRisk, CostRow, CovCell, DebtGroup, DebtItem, Health, LoadBar, Me11Engine, ORDER_TYPES, OutsourcedOp, PRODUCT_COLORS,
  SimResult, stdRun,
} from './me11/me11-engine';
import { Me11FlowComponent } from './me11/me11-flow.component';

type Space = 'map' | 'calib' | 'sim' | 'cov' | 'ext' | 'debt';
type DebtBy = 'cat' | 'form' | 'routing' | 'owner' | 'product';

/**
 * FRM-ME-11 — «رصدخانه‌ی مهندسی تولید» (BI مهندسی تولید برای جلسه‌ی بازبینی مهندسی؛ به درخواست کاربر).
 *
 * یک دامنه‌ی مشترک (خط، نوع روش بچی/پیوسته، کالا، وضعیت، جست‌وجو) و یک «برنامه‌ی اصلاح» مشترک (نقص‌هایی که برای رفع
 * علامت خورده‌اند) شش فضا را می‌رانند: نقشه‌ی سلامت روش‌ها (گراف هر روش رنگ‌شده با نقص‌ها، چک‌لیست ۱۳ دسته‌ای با فرم مالک)،
 * استاندارد در برابر واقعیت (کالیبراسیون زمان اجرا با گزارش‌های PC-04، بازده و کارکرد، با پیشنهاد انقباضی)، شبیه‌ساز گلوگاه
 * (ترکیب هفتگی از تقاضای باز، کارایی، شیفت/دستگاه اضافه، انتقال به عملیات جایگزین، استاندارد کالیبره‌شده)، پوشش نسخه‌ی تولید
 * (ماتریس کالا × خط × نوع دستور با نوار «برنده بر حسب مقدار»)، وابستگی بیرونی و هزینه، و بدهی فنی رتبه‌بندی‌شده.
 *
 * فاز اول: فقط‌خواندنی، همه از /api/me11/bundle. برنامه‌ی اصلاح فقط در حافظه‌ی صفحه است؛ ثبت اصلاح استانداردها (ME-03)،
 * ارجاع نقص به مالک و ذخیره‌ی سناریوی شبیه‌ساز با فاز ایجاد/ویرایش می‌آید.
 */
@Component({
  selector: 'gng-frm-me-11',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ButtonModule, TooltipModule, OperationalFormLayoutComponent, DataSourceBadgeComponent, Me11FlowComponent],
  templateUrl: './frm-me-11.component.html',
  styles: [`
    .bp { --bp-bg: #0a2240; --bp-p: #0e2c52; --bp-p2: #123661; --bp-line: rgba(126, 190, 255, 0.22); --bp-ink: #e4f1ff; --bp-mut: #8fb3d6; --bp-cyan: #5fd3ff;
      --bp-ok: var(--gng-success); --bp-warn: var(--gng-warning); --bp-bad: var(--gng-danger); --bp-info: var(--gng-info);
      background-color: var(--bp-bg); color: var(--bp-ink); border-radius: var(--gng-radius); padding: 0.9rem; display: flex; flex-direction: column; gap: 0.8rem; min-height: 30rem;
      background-image: linear-gradient(rgba(126,190,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(126,190,255,0.07) 1px, transparent 1px),
        linear-gradient(rgba(126,190,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(126,190,255,0.03) 1px, transparent 1px);
      background-size: 80px 80px, 80px 80px, 16px 16px, 16px 16px; }
    .bp__state { padding: 2rem; text-align: center; color: var(--bp-mut); }
    .bp__state--err { color: #ff9b9b; }
    .bp__scope { border: 1px dashed var(--bp-line); border-radius: var(--gng-radius); padding: 0.55rem 0.75rem; display: flex; flex-wrap: wrap; gap: 0.45rem 1.1rem; align-items: center; background: rgba(10,34,64,0.7); }
    .seg { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; }
    .dim { color: var(--bp-mut); font-size: 0.72rem; }
    .chip { background: transparent; color: var(--bp-ink); border: 1px solid var(--bp-line); border-radius: 99px; padding: 0.15rem 0.65rem; font-size: 0.74rem; cursor: pointer; font-family: inherit; white-space: nowrap; }
    .chip:hover { border-color: var(--bp-cyan); }
    .chip--on { background: var(--bp-cyan); color: #04213d; border-color: var(--bp-cyan); font-weight: 700; }
    .inp { background: var(--bp-p2); color: var(--bp-ink); border: 1px solid var(--bp-line); border-radius: 6px; padding: 0.2rem 0.45rem; font-family: inherit; font-size: 0.76rem; }
    .inp--num { width: 7rem; direction: ltr; text-align: left; }
    .inp:focus { outline: 1px solid var(--bp-cyan); }
    .crumb { width: 100%; font-family: monospace; font-size: 0.78rem; color: var(--bp-cyan); }
    .inst { display: grid; grid-template-columns: repeat(auto-fit, minmax(10.5rem, 1fr)); gap: 0.55rem; }
    .gauge { border: 1px solid var(--bp-line); border-radius: 10px; padding: 0.5rem 0.7rem; background: rgba(14,44,82,0.85); cursor: pointer; text-align: right; color: inherit; font-family: inherit; }
    .gauge:hover { border-color: var(--bp-cyan); }
    .gauge__l { font-size: 0.7rem; color: var(--bp-mut); }
    .gauge__v { font-size: 1.55rem; font-weight: 800; font-family: monospace; line-height: 1.25; }
    .gauge__s { font-size: 0.66rem; color: var(--bp-mut); }
    .t-ok { color: #7ee2a8; } .t-info { color: #7fc8ff; } .t-warn { color: #ffcf6e; } .t-bad { color: #ff8a8a; } .t-muted { color: var(--bp-mut); }
    .rail { display: flex; gap: 0.3rem; flex-wrap: wrap; border-bottom: 1px solid var(--bp-line); }
    .rail button { background: none; border: none; color: var(--bp-mut); font-family: inherit; font-size: 0.85rem; padding: 0.45rem 0.8rem; cursor: pointer; display: flex; gap: 0.35rem; align-items: center; border-radius: 8px 8px 0 0; }
    .rail button:hover { color: var(--bp-ink); }
    .rail button.on { color: #fff; background: var(--bp-p); box-shadow: inset 0 -3px 0 var(--bp-cyan); font-weight: 700; }
    .rail b { background: rgba(255,255,255,0.1); border-radius: 99px; padding: 0 0.45rem; font-size: 0.68rem; font-family: monospace; }
    .rail b.hot { background: #b3261e; color: #fff; }
    .sp { display: flex; flex-direction: column; gap: 0.8rem; }
    .panel { position: relative; background: rgba(14,44,82,0.92); border: 1px solid var(--bp-line); border-radius: var(--gng-radius); padding: 0.75rem 0.9rem; min-width: 0; }
    .panel h3 { margin: 0 0 0.5rem; font-size: 0.95rem; color: #fff; }
    .panel h3 small { color: var(--bp-mut); font-weight: 400; font-size: 0.72rem; }
    .ph { display: flex; justify-content: space-between; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.45rem; }
    .ph h3 { margin: 0; }
    .hint { font-size: 0.7rem; color: var(--bp-mut); line-height: 1.7; margin-top: 0.4rem; }
    .story { margin: 0.3rem 0 0; font-size: 0.8rem; line-height: 1.8; border-right: 3px solid var(--bp-cyan); padding: 0.35rem 0.6rem; background: rgba(95,211,255,0.06); border-radius: 4px; }
    .empty { color: var(--bp-mut); font-size: 0.8rem; padding: 0.5rem 0; }
    .mono { font-family: monospace; }
    .cols { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 0.8rem; align-items: start; }
    @media (max-width: 1150px) { .cols { grid-template-columns: 1fr; } }
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(13.5rem, 1fr)); gap: 0.55rem; }
    .rc { border: 1px solid var(--bp-line); border-radius: 10px; padding: 0.5rem 0.6rem; background: rgba(18,54,97,0.6); cursor: pointer; display: flex; flex-direction: column; gap: 0.3rem; }
    .rc:hover { border-color: var(--bp-cyan); }
    .rc--on { border-color: #fff; box-shadow: 0 0 0 1px #fff inset; }
    .rc--muted { opacity: 0.62; }
    .rc__h { display: flex; gap: 0.45rem; align-items: center; }
    .rc__t { flex: 1; min-width: 0; font-size: 0.74rem; }
    .rc__t b { display: block; font-family: monospace; font-size: 0.8rem; }
    .rc__t span { color: var(--bp-mut); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ring { width: 2.7rem; height: 2.7rem; border-radius: 50%; display: grid; place-items: center; flex: none; }
    .ring span { width: 2.1rem; height: 2.1rem; border-radius: 50%; background: var(--bp-p); display: grid; place-items: center; font-size: 0.74rem; font-weight: 800; font-family: monospace; }
    .ring--lg { width: 4.2rem; height: 4.2rem; } .ring--lg span { width: 3.3rem; height: 3.3rem; font-size: 1.05rem; }
    .dots { display: flex; gap: 3px; flex-wrap: wrap; }
    .dot { width: 9px; height: 9px; border-radius: 2px; background: rgba(126,190,255,0.25); }
    .dot--1 { background: #ffd166; } .dot--2 { background: #ff9f43; } .dot--3 { background: #ff5d5d; }
    .rc__m { display: flex; justify-content: space-between; font-size: 0.64rem; color: var(--bp-mut); }
    .proj { font-size: 0.66rem; color: #7ee2a8; font-family: monospace; }
    .dh { display: flex; gap: 0.8rem; align-items: center; flex-wrap: wrap; }
    .dh__id b { font-family: monospace; font-size: 1.05rem; color: var(--bp-cyan); }
    .dh__id div { font-size: 0.78rem; }
    .kv { display: flex; flex-wrap: wrap; gap: 0.25rem 0.9rem; font-size: 0.72rem; color: var(--bp-mut); }
    .kv b { color: #fff; font-weight: 600; }
    .ck { border-top: 1px dashed var(--bp-line); padding: 0.35rem 0; }
    .ck__h { display: flex; gap: 0.4rem; align-items: center; font-size: 0.8rem; cursor: pointer; }
    .ck__h i { font-size: 0.85rem; }
    .ck__h small { color: var(--bp-mut); margin-right: auto; }
    .form { font-family: monospace; font-size: 0.66rem; border: 1px solid var(--bp-line); border-radius: 5px; padding: 0 0.35rem; color: var(--bp-cyan); text-decoration: none; white-space: nowrap; }
    .form:hover { background: rgba(95,211,255,0.12); }
    .df { display: grid; grid-template-columns: 1.1rem 1fr auto; gap: 0.35rem; align-items: start; font-size: 0.74rem; padding: 0.15rem 0 0.15rem 0; margin-right: 1.1rem; }
    .df small { display: block; color: var(--bp-mut); font-size: 0.66rem; }
    .df input { accent-color: var(--bp-cyan); margin-top: 0.15rem; }
    .df--fixed { text-decoration: line-through; opacity: 0.55; }
    .sev { display: inline-block; font-size: 0.6rem; border-radius: 99px; padding: 0 0.4rem; margin-left: 0.25rem; }
    .sev--1 { background: rgba(255,209,102,0.18); color: #ffd166; } .sev--2 { background: rgba(255,159,67,0.2); color: #ffb26b; } .sev--3 { background: rgba(255,93,93,0.25); color: #ff9b9b; }
    .opc { margin-top: 0.5rem; border: 1px solid var(--bp-line); border-radius: 8px; padding: 0.5rem 0.65rem; background: rgba(10,34,64,0.6); font-size: 0.74rem; }
    .opc h4 { margin: 0 0 0.3rem; font-size: 0.82rem; color: var(--bp-cyan); }
    .tbl { width: 100%; border-collapse: collapse; font-size: 0.74rem; }
    .tbl th { text-align: right; color: var(--bp-mut); font-weight: 400; border-bottom: 1px solid var(--bp-line); padding: 0.25rem 0.35rem; white-space: nowrap; }
    .tbl td { padding: 0.28rem 0.35rem; border-bottom: 1px solid rgba(126,190,255,0.08); vertical-align: middle; }
    .tbl tr.click { cursor: pointer; } .tbl tr.click:hover td { background: rgba(95,211,255,0.06); }
    .tbl tr.on td { background: rgba(95,211,255,0.1); }
    .num { font-family: monospace; direction: ltr; text-align: left; white-space: nowrap; }
    .strip { position: relative; height: 1.3rem; min-width: 12rem; background: linear-gradient(90deg, rgba(126,190,255,0.08), rgba(126,190,255,0.02)); border-radius: 4px; direction: ltr; }
    .strip__rng { position: absolute; top: 0.55rem; height: 0.2rem; background: rgba(255,255,255,0.25); border-radius: 2px; }
    .strip__std { position: absolute; top: 0; bottom: 0; width: 2px; background: #fff; }
    .strip__med { position: absolute; top: 0.15rem; bottom: 0.15rem; width: 3px; background: #ffcf6e; border-radius: 2px; }
    .strip__sug { position: absolute; top: 0.32rem; width: 0.55rem; height: 0.55rem; background: #7ee2a8; transform: translateX(-50%) rotate(45deg); }
    .strip__dot { position: absolute; top: 0.47rem; width: 0.38rem; height: 0.38rem; border-radius: 50%; background: var(--bp-cyan); transform: translateX(-50%); opacity: 0.85; }
    .strip__dot--adj { background: transparent; border: 1px solid var(--bp-cyan); }
    .pill { display: inline-block; font-size: 0.64rem; padding: 0 0.4rem; border-radius: 99px; background: rgba(255,255,255,0.08); white-space: nowrap; }
    .pill--ok { background: rgba(126,226,168,0.16); color: #7ee2a8; } .pill--warn { background: rgba(255,207,110,0.16); color: #ffcf6e; } .pill--bad { background: rgba(255,93,93,0.2); color: #ff9b9b; }
    .pill--info { background: rgba(127,200,255,0.16); color: #7fc8ff; } .pill--muted { color: var(--bp-mut); }
    .ctl { display: flex; flex-wrap: wrap; gap: 0.5rem 1.2rem; align-items: center; font-size: 0.76rem; }
    .ctl input[type='range'] { accent-color: var(--bp-cyan); width: 8rem; direction: ltr; vertical-align: middle; }
    .ctl label { display: flex; align-items: center; gap: 0.35rem; }
    .ctl input[type='checkbox'] { accent-color: var(--bp-cyan); }
    .sim { display: grid; grid-template-columns: minmax(19rem, 25rem) minmax(0, 1fr); gap: 0.8rem; align-items: start; }
    @media (max-width: 1100px) { .sim { grid-template-columns: 1fr; } }
    .mix { display: grid; grid-template-columns: 0.8rem 1fr 7rem; gap: 0.3rem 0.45rem; align-items: center; font-size: 0.74rem; }
    .mix select { grid-column: 2 / 4; }
    .sw { width: 0.7rem; height: 0.7rem; border-radius: 3px; }
    .lb { display: grid; grid-template-columns: 11rem 1fr 4.5rem; gap: 0.5rem; align-items: center; padding: 0.3rem 0; border-bottom: 1px dashed rgba(126,190,255,0.12); font-size: 0.74rem; }
    .lb__k { min-width: 0; }
    .lb__k b { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .lb__k small { color: var(--bp-mut); font-size: 0.64rem; }
    .lb__t { position: relative; height: 1.15rem; background: rgba(126,190,255,0.07); border-radius: 3px; direction: ltr; overflow: hidden; }
    .lb__seg { position: absolute; top: 0; bottom: 0; }
    .lb__cap { position: absolute; top: -2px; bottom: -2px; width: 2px; background: #fff; }
    .lb--hot { background: rgba(255,93,93,0.07); border-radius: 6px; }
    .lb__v { font-family: monospace; text-align: left; font-weight: 700; }
    .lb__x { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 0.3rem 0.9rem; font-size: 0.66rem; color: var(--bp-mut); }
    .lb__x label { display: flex; gap: 0.25rem; align-items: center; cursor: pointer; }
    .lb__x input { accent-color: var(--bp-cyan); }
    .cov { border-collapse: separate; border-spacing: 3px; font-size: 0.72rem; width: 100%; }
    .cov th { color: var(--bp-mut); font-weight: 400; padding: 0.2rem; white-space: nowrap; }
    .cov td.cell { border-radius: 6px; padding: 0.3rem 0.35rem; text-align: center; cursor: pointer; font-family: monospace; font-size: 0.68rem; min-width: 4.5rem; border: 1px solid transparent; }
    .cell--ok { background: rgba(126,226,168,0.14); color: #a9f0c6; } .cell--warn { background: rgba(255,207,110,0.18); color: #ffdc94; }
    .cell--bad { background: rgba(255,93,93,0.2); color: #ffb0b0; } .cell--muted { background: rgba(255,255,255,0.03); color: var(--bp-mut); }
    .cell--on { border-color: #fff !important; }
    .cell small { display: block; font-size: 0.58rem; opacity: 0.8; }
    .bands { position: relative; height: 2rem; background: rgba(255,255,255,0.04); border-radius: 5px; direction: ltr; margin-top: 0.4rem; }
    .band { position: absolute; top: 0; bottom: 0; display: flex; align-items: center; justify-content: center; font-size: 0.62rem; overflow: hidden; white-space: nowrap; border-left: 1px solid var(--bp-bg); }
    .band--win { background: rgba(95,211,255,0.35); color: #e4f1ff; } .band--tie { background: repeating-linear-gradient(135deg, rgba(255,207,110,0.45) 0 5px, rgba(255,207,110,0.15) 5px 10px); color: #fff; }
    .band--gap { background: repeating-linear-gradient(45deg, rgba(255,93,93,0.25) 0 4px, transparent 4px 8px); color: #ffb0b0; }
    .ticks { position: relative; height: 1rem; direction: ltr; font-size: 0.58rem; color: var(--bp-mut); }
    .ticks span { position: absolute; transform: translateX(-50%); }
    .dmd { position: absolute; top: -0.35rem; width: 2px; height: 2.7rem; background: #fff; }
    .dmd--miss { background: #ff5d5d; }
    .risk { display: grid; grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr)); gap: 0.6rem; }
    .rk { border: 1px solid var(--bp-line); border-radius: 10px; padding: 0.55rem 0.7rem; background: rgba(18,54,97,0.55); font-size: 0.74rem; display: flex; flex-direction: column; gap: 0.25rem; }
    .rk--bad { border-color: rgba(255,93,93,0.6); } .rk--warn { border-color: rgba(255,207,110,0.5); }
    .rk__h { display: flex; justify-content: space-between; gap: 0.4rem; align-items: center; }
    .rk__h b { font-size: 0.85rem; }
    .rk__s { font-family: monospace; font-weight: 800; font-size: 1.1rem; }
    .rk ul { margin: 0; padding-right: 1rem; color: #cfe3f7; }
    .bar { display: inline-block; height: 0.5rem; border-radius: 3px; background: var(--bp-cyan); vertical-align: middle; }
    .bar--bg { background: rgba(126,190,255,0.12); width: 7rem; position: relative; overflow: hidden; }
    .bar--bg i { position: absolute; top: 0; bottom: 0; right: 0; background: #7ee2a8; }
    .dg { border-top: 1px dashed var(--bp-line); padding: 0.4rem 0; }
    .dg__h { display: grid; grid-template-columns: 1fr 10rem 4.5rem; gap: 0.5rem; align-items: center; cursor: pointer; font-size: 0.8rem; }
    .dg__b { height: 0.55rem; background: rgba(126,190,255,0.1); border-radius: 3px; overflow: hidden; direction: ltr; }
    .dg__b i { display: block; height: 100%; background: linear-gradient(90deg, #ff9f43, #ff5d5d); }
    .di { display: grid; grid-template-columns: 1.1rem 3.2rem 1fr auto; gap: 0.4rem; align-items: start; font-size: 0.74rem; padding: 0.22rem 0; }
    .di__imp { font-family: monospace; font-weight: 800; text-align: center; background: rgba(255,255,255,0.06); border-radius: 5px; }
    .di small { display: block; color: var(--bp-mut); font-size: 0.66rem; }
    .di input { accent-color: var(--bp-cyan); margin-top: 0.2rem; }
    .owners { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .own { border: 1px solid var(--bp-line); border-radius: 8px; padding: 0.3rem 0.55rem; font-size: 0.72rem; }
    .own b { font-family: monospace; margin-right: 0.3rem; }
    .todo { margin: 0; }
    .ctx { display: flex; flex-direction: column; gap: 0.25rem; }
    .ctx__i { display: flex; gap: 0.45rem; align-items: center; padding: 0.3rem 0.4rem; border-radius: 6px; cursor: pointer; font-size: 0.78rem; border: 1px solid transparent; }
    .ctx__i:hover { background: var(--gng-bg); }
    .ctx__i--on { border-color: var(--gng-primary); background: var(--gng-bg); }
    .ctx__i small { display: block; color: var(--gng-text-muted); font-size: 0.68rem; }
    .ctx__s { font-family: monospace; font-weight: 800; min-width: 2.2rem; text-align: center; border-radius: 6px; padding: 0.1rem 0; color: #fff; }
    .ctx__s--ok { background: var(--gng-success); } .ctx__s--info { background: var(--gng-info); } .ctx__s--warn { background: var(--gng-warning); } .ctx__s--bad { background: var(--gng-danger); }
  `],
})
export class FrmMe11Component implements OnInit {
  readonly companyId = DEMO_COMPANY_ID;
  loading = false;
  loadFailed = false;
  data: Me11Bundle | null = null;
  eng: Me11Engine | null = null;
  space: Space = 'map';

  // ───────── دامنه ─────────
  lines: Line[] = [];
  products: CovProduct[] = [];
  scopeLines: number[] = [];
  scopeTypes: number[] = [];
  scopeProduct: number | null = null;
  showAll = false;
  search = '';
  scoped: Routing[] = [];
  scopedIds = new Set<number>();
  breadcrumb = '';

  // ───────── برنامه‌ی اصلاح (مشترک بین فضاها) ─────────
  fixed = new Set<string>();

  // ───────── ۱) سلامت ─────────
  healths: Health[] = [];
  private healthById = new Map<number, Health>();
  sel: Health | null = null;
  selOpId: number | null = null;
  selOp: { op: Op; defects: Defect[]; inherited: Defect[]; alts: string[]; subs: Subcontract[]; std: number } | null = null;
  openCat: string | null = null;
  avgHealth = 0;

  // ───────── ۲) کالیبراسیون ─────────
  calRework = false;
  calMode: 'auto' | 'manual' = 'auto';
  calK = 4;
  calW = 0.5;
  calOnlyBias = false;
  cal: CalResult | null = null;
  calRows: CalRow[] = [];
  calBiased = 0;
  calOpen: number | null = null;

  // ───────── ۳) شبیه‌ساز ─────────
  simProducts: CovProduct[] = [];
  simMix: Record<number, number> = {};
  simRoute: Record<number, number> = {};
  simHorizon = 2;
  simEff = 100;
  simQty = 100;
  simExtraShift: Record<string, boolean> = {};
  simExtraUnit: Record<string, number> = {};
  simAlt: Record<number, number> = {};
  simUseCal = false;
  sim: SimResult | null = null;
  simBase: SimResult | null = null;
  altOps: { roId: number; label: string; alt: string }[] = [];
  simOpen: string | null = null;

  // ───────── ۴) پوشش نسخه ─────────
  covCells = new Map<string, CovCell>();
  covProducts: CovProduct[] = [];
  covSel: CovCell | null = null;
  covBands: Band[] = [];
  covTicks: { left: number; label: string }[] = [];
  covAxis = 1;
  covDemand: { number: string; qty: number; covered: boolean; winner: string; left: number }[] = [];
  covProbe = 0;
  covWinner = '';
  covGaps = 0;
  covConflicts = 0;

  // ───────── ۵) بیرونی و هزینه ─────────
  risks: ContractorRisk[] = [];
  outOps: OutsourcedOp[] = [];
  costRows: CostRow[] = [];

  // ───────── ۶) بدهی ─────────
  debtBy: DebtBy = 'cat';
  debtItems: DebtItem[] = [];
  debtGroups: DebtGroup[] = [];
  debtOpen: string | null = null;
  debtTotal = 0;
  debtPlanned = 0;
  owners: { owner: string; impact: number; count: number }[] = [];

  bannerText = 'در حال خواندن…';
  bannerTone: BannerTone = 'info';
  contextLabel = '';

  readonly orderTypes = ORDER_TYPES;
  readonly orderType = ORDER_TYPE;
  readonly sevLabel = SEV_LABEL;
  readonly catLabel = CAT_LABEL;
  readonly routingStatus = ROUTING_STATUS;
  readonly nature = NATURE;
  readonly qualStatus = QUAL_STATUS;
  readonly healthFormula = HEALTH_FORMULA;
  readonly calibFormula = CALIB_FORMULA;
  readonly simFormula = SIM_FORMULA;
  readonly debtFormula = DEBT_FORMULA;
  readonly colors = PRODUCT_COLORS;
  readonly faNum = faNum;
  readonly faInt = faInt;
  readonly faPct = faPct;
  readonly faDay = faDay;
  readonly dsHealth = this.ds('me11-health', 'سلامت روش‌ها');
  readonly dsDefects = this.ds('me11-defects', 'کاتالوگ نقص‌ها');
  readonly dsActual = this.ds('me11-actual', 'گزارش‌ها در برابر استاندارد');
  readonly dsCoverage = this.ds('me11-coverage', 'صلاحیت نسخه‌ها');
  readonly dsCapacity = this.ds('me11-capacity', 'مدل ظرفیت');
  readonly dsSubs = this.ds('me07-subcontracts', 'پیمانکاران عملیات');

  constructor(private svc: FrmMe11Service) {}

  ngOnInit(): void {
    this.loading = true;
    this.svc.bundle(this.companyId).subscribe({
      next: (b) => {
        this.data = b;
        this.eng = new Me11Engine(b);
        this.lines = b.lines;
        this.products = b.products;
        this.loading = false;
        this.initSim();
        this.recompute();
      },
      error: (err) => {
        console.warn('[FRM-ME-11] خواندن داده ناموفق بود:', err?.message || err);
        this.loading = false;
        this.loadFailed = true;
        this.bannerText = 'خواندن داده از gng-mfr-api ناموفق بود. اجرای mes_frm_me11_setup.sql و endpoint ‎/api/me11/bundle را بررسی کنید.';
        this.bannerTone = 'danger';
      },
    });
  }

  // ───────── دامنه ─────────

  toggleLine(id: number): void {
    this.scopeLines = this.scopeLines.includes(id) ? this.scopeLines.filter((x) => x !== id) : [...this.scopeLines, id];
    this.recompute();
  }

  toggleType(t: number): void {
    this.scopeTypes = this.scopeTypes.includes(t) ? this.scopeTypes.filter((x) => x !== t) : [...this.scopeTypes, t];
    this.recompute();
  }

  setProduct(id: number | null): void {
    this.scopeProduct = this.scopeProduct === id ? null : id;
    this.recompute();
  }

  setShowAll(v: boolean): void {
    this.showAll = v;
    this.recompute();
  }

  onSearch(v: string): void {
    this.search = v;
    this.recompute();
  }

  clearScope(): void {
    this.scopeLines = [];
    this.scopeTypes = [];
    this.scopeProduct = null;
    this.search = '';
    this.recompute();
  }

  private recompute(): void {
    const e = this.eng;
    if (!e || !this.data) return;
    const q = this.search.trim();
    this.scoped = this.data.routings.filter(
      (r) =>
        (this.showAll || (!r.isTemplate && r.status !== 4)) &&
        (!this.scopeLines.length || (r.lineId !== null && this.scopeLines.includes(r.lineId))) &&
        (!this.scopeTypes.length || this.scopeTypes.includes(r.ptype)) &&
        (this.scopeProduct === null || r.productId === this.scopeProduct) &&
        (!q || `${r.code} ${r.version} ${r.title} ${r.product}`.includes(q))
    );
    this.scopedIds = new Set(this.scoped.map((r) => r.id));
    const lines = this.scopeLines.length ? this.lines.filter((l) => this.scopeLines.includes(l.id)).map((l) => l.title).join('، ') : 'همه‌ی خطوط';
    const types = this.scopeTypes.length ? this.scopeTypes.map((t) => (t === 2 ? 'پیوسته' : 'بچی')).join(' و ') : 'بچی و پیوسته';
    const prod = this.scopeProduct !== null ? ` · ${this.products.find((p) => p.id === this.scopeProduct)?.title ?? ''}` : '';
    this.breadcrumb = `${lines} · ${types}${prod} · ${faInt(this.scoped.length)} روش${this.showAll ? ' (با الگو و منسوخ)' : ''}`;
    this.recomputeHealth();
    this.recomputeCal();
    this.recomputeCoverage();
    this.recomputeExternal();
    this.recomputeDebt();
    this.runSim();
    this.updateBanner();
  }

  // ───────── ۱) سلامت ─────────

  private recomputeHealth(): void {
    const e = this.eng;
    if (!e) return;
    this.healthById.clear();
    this.healths = this.scoped
      .map((r) => {
        const base = e.health(r);
        const proj = this.fixed.size ? e.health(r, this.fixed) : base;
        const h = { ...proj, base: base.score };
        this.healthById.set(r.id, h);
        return h;
      })
      .sort((a, b) => a.score - b.score);
    const live = this.healths.filter((h) => !h.routing.isTemplate);
    this.avgHealth = live.length ? Math.round(live.reduce((a, h) => a + h.score, 0) / live.length) : 0;
    const keep = this.sel ? this.healthById.get(this.sel.routing.id) : undefined;
    this.sel = keep ?? this.healths[0] ?? null;
    if (this.sel && this.selOpId !== null && !(e.opsByRouting.get(this.sel.routing.id) ?? []).some((o) => o.id === this.selOpId)) this.selOpId = null;
    this.buildSelOp();
    this.contextLabel = this.sel ? `${this.sel.routing.code} ${this.sel.routing.version}` : '';
  }

  pickRouting(id: number): void {
    this.sel = this.healthById.get(id) ?? null;
    this.selOpId = null;
    this.openCat = null;
    this.buildSelOp();
    this.contextLabel = this.sel ? `${this.sel.routing.code} ${this.sel.routing.version}` : '';
  }

  pickOp(id: number): void {
    this.selOpId = this.selOpId === id ? null : id;
    this.buildSelOp();
  }

  private buildSelOp(): void {
    const e = this.eng;
    const op = this.selOpId !== null ? e?.opById.get(this.selOpId) : undefined;
    if (!e || !op || !this.data) {
      this.selOp = null;
      return;
    }
    this.selOp = {
      op, std: stdRun(op),
      defects: this.data.defects.filter((d) => d.roId === op.id),
      inherited: e.libByOp.get(op.opId) ?? [],
      alts: (e.altsByRo.get(op.id) ?? []).map((a) => `${a.title} روی ${a.resTitle || 'منبع کتابخانه'}`),
      subs: e.subsByRo.get(op.id) ?? [],
    };
  }

  selOps(): Op[] {
    return this.sel && this.eng ? this.eng.opsByRouting.get(this.sel.routing.id) ?? [] : [];
  }

  opsOf(id: number): Op[] {
    return this.eng?.opsByRouting.get(id) ?? [];
  }

  linksOf(id: number): Me11Bundle['links'] {
    return this.data ? this.data.links.filter((l) => l.routingId === id) : [];
  }

  toggleCat(cat: string): void {
    this.openCat = this.openCat === cat ? null : cat;
  }

  isFixed(key: string): boolean {
    return this.fixed.has(key);
  }

  toggleFix(key: string): void {
    const s = new Set(this.fixed);
    if (s.has(key)) s.delete(key);
    else s.add(key);
    this.fixed = s;
    this.recomputeHealth();
    this.recomputeDebt();
    this.updateBanner();
  }

  clearFixes(): void {
    this.fixed = new Set();
    this.recomputeHealth();
    this.recomputeDebt();
    this.updateBanner();
  }

  ring(score: number): string {
    const c = score >= 90 ? '#7ee2a8' : score >= 70 ? '#7fc8ff' : score >= 50 ? '#ffcf6e' : '#ff8a8a';
    return `conic-gradient(${c} ${score * 3.6}deg, rgba(126,190,255,0.14) 0)`;
  }

  // ───────── ۲) کالیبراسیون ─────────

  recomputeCal(): void {
    if (!this.eng) return;
    this.cal = this.eng.calibrate(this.scopedIds, this.calRework, this.calMode, this.calK, this.calW);
    const biased = this.cal.rows.filter((r) => r.hasStd && (r.systematic || Math.abs(r.bias) >= 15));
    this.calBiased = biased.length;
    this.calRows = this.calOnlyBias ? biased : this.cal.rows;
    if (this.simUseCal) this.runSim();
  }

  setCal(patch: Partial<{ calRework: boolean; calMode: 'auto' | 'manual'; calK: number; calW: number; calOnlyBias: boolean }>): void {
    Object.assign(this, patch);
    this.recomputeCal();
  }

  toggleCalRow(id: number): void {
    this.calOpen = this.calOpen === id ? null : id;
  }

  confTone(c: string): Tone {
    return c === 'high' ? 'ok' : c === 'medium' ? 'info' : 'muted';
  }

  confLabel(c: string): string {
    return c === 'high' ? 'اطمینان بالا' : c === 'medium' ? 'اطمینان متوسط' : 'اطمینان کم';
  }

  biasTone(b: number): Tone {
    const a = Math.abs(b);
    return a >= 30 ? 'bad' : a >= 15 ? 'warn' : 'ok';
  }

  /** «۰٫۰۰۰۵۵ دقیقه/واحد» برای قرص خیلی کوچک است؛ به‌ازای ۱۰۰۰ واحد نمایش داده می‌شود */
  perK(v: number): string {
    return faNum(v * 1000, 2);
  }

  useCalibrated(): void {
    this.simUseCal = true;
    this.space = 'sim';
    this.runSim();
  }

  // ───────── ۳) شبیه‌ساز ─────────

  private initSim(): void {
    const e = this.eng;
    if (!e || !this.data) return;
    this.simProducts = this.data.products.filter((p) => e.routesFor(p.id).length > 0);
    this.simMix = e.defaultMix(this.simHorizon, SHOP_NOW.getTime());
    for (const p of this.simProducts) {
      const r = e.defaultRoute(p.id);
      if (r !== null) this.simRoute[p.id] = r;
      if (this.simMix[p.id] === undefined) this.simMix[p.id] = 0;
    }
  }

  routesFor(pid: number): Routing[] {
    return this.eng ? this.eng.routesFor(pid) : [];
  }

  setMix(pid: number, v: number | string): void {
    this.simMix = { ...this.simMix, [pid]: Math.max(0, Number(v) || 0) };
    this.runSim();
  }

  setRoute(pid: number, v: number | string): void {
    this.simRoute = { ...this.simRoute, [pid]: Number(v) };
    this.runSim();
  }

  setSim(patch: Partial<{ simHorizon: number; simEff: number; simQty: number; simUseCal: boolean }>): void {
    Object.assign(this, patch);
    this.runSim();
  }

  refillMix(): void {
    if (!this.eng) return;
    const m = this.eng.defaultMix(this.simHorizon, SHOP_NOW.getTime());
    this.simMix = Object.fromEntries(this.simProducts.map((p) => [p.id, m[p.id] ?? 0]));
    this.runSim();
  }

  setShift(key: string, v: boolean): void {
    this.simExtraShift = { ...this.simExtraShift, [key]: v };
    this.runSim();
  }

  setUnit(key: string, v: number | string): void {
    this.simExtraUnit = { ...this.simExtraUnit, [key]: Math.max(0, Math.min(5, Number(v) || 0)) };
    this.runSim();
  }

  setAlt(roId: number, v: number | string): void {
    this.simAlt = { ...this.simAlt, [roId]: Number(v) || 0 };
    this.runSim();
  }

  resetSim(): void {
    this.simExtraShift = {};
    this.simExtraUnit = {};
    this.simAlt = {};
    this.simEff = 100;
    this.simQty = 100;
    this.simUseCal = false;
    this.runSim();
  }

  toggleBar(key: string): void {
    this.simOpen = this.simOpen === key ? null : key;
  }

  runSim(): void {
    const e = this.eng;
    if (!e) return;
    const pids = this.simProducts.filter((p) => this.scopeProduct === null || p.id === this.scopeProduct).map((p) => p.id);
    const calibrated: Record<number, number> = {};
    if (this.simUseCal && this.cal) for (const r of this.cal.rows) if (r.hasStd && r.confidence !== 'low') calibrated[r.roId] = r.suggested;
    const params = {
      mix: this.simMix, routeOf: this.simRoute, horizon: this.simHorizon, eff: this.simEff, qtyMult: this.simQty / 100,
      extraShift: this.simExtraShift, extraUnit: this.simExtraUnit, altShare: this.simAlt, calibrated: this.simUseCal ? calibrated : null,
    };
    this.sim = e.simulate(params, pids);
    this.simBase = e.simulate({ ...params, eff: 100, qtyMult: 1, extraShift: {}, extraUnit: {}, altShare: {}, calibrated: null }, pids);
    this.altOps = pids
      .flatMap((pid) => e.opsByRouting.get(this.simRoute[pid]) ?? [])
      .filter((o) => o.altCount > 0)
      .map((o) => ({ roId: o.id, label: `${e.routingLabel(o.routingId)}/${o.seq} ${o.title}`, alt: (e.altsByRo.get(o.id) ?? [])[0]?.resTitle ?? '' }));
  }

  simShown(): CovProduct[] {
    return this.simProducts.filter((p) => this.scopeProduct === null || p.id === this.scopeProduct);
  }

  simColor(pid: number): string {
    const i = this.simShown().findIndex((p) => p.id === pid);
    return PRODUCT_COLORS[Math.max(0, i) % PRODUCT_COLORS.length];
  }

  simDelta(b: LoadBar): string {
    const base = this.simBase?.bars.find((x) => x.key === b.key);
    if (!base || !Number.isFinite(base.util) || !Number.isFinite(b.util)) return '';
    const d = b.util - base.util;
    return Math.abs(d) < 0.5 ? '' : `${d > 0 ? '+' : '−'}${faNum(Math.abs(d), 0)}`;
  }

  hours(min: number): string {
    return faNum(min / 60, 1);
  }

  // ───────── ۴) پوشش نسخه ─────────

  private recomputeCoverage(): void {
    const e = this.eng;
    if (!e) return;
    this.covProducts = this.products.filter((p) => this.scopeProduct === null || p.id === this.scopeProduct);
    const lineIds = (this.scopeLines.length ? this.lines.filter((l) => this.scopeLines.includes(l.id)) : this.lines).map((l) => l.id);
    this.covCells = e.coverage(this.covProducts.map((p) => p.id), lineIds);
    const cells = [...this.covCells.values()];
    // شکاف معنادار: خانه‌ی دستور عادی بی‌نسخه که تقاضا دارد یا نسخه‌اش رد شده (نه هر خط بی‌ربط)
    this.covGaps = cells.filter((c) => c.status === 'gap' && c.orderType === 1 && (c.demand.length > 0 || c.rejected.length > 0)).length;
    this.covConflicts = cells.filter((c) => c.status === 'conflict').length;
    if (this.covSel) this.pickCell(this.covSel.productId, this.covSel.lineId, this.covSel.orderType, false);
  }

  covLines(): Line[] {
    return this.scopeLines.length ? this.lines.filter((l) => this.scopeLines.includes(l.id)) : this.lines;
  }

  cell(pid: number, lid: number, ot: number): CovCell | null {
    return this.covCells.get(`${pid}-${lid}-${ot}`) ?? null;
  }

  pickCell(pid: number, lid: number, ot: number, toggle = true): void {
    const c = this.cell(pid, lid, ot);
    if (!c || !this.eng) return;
    if (toggle && this.covSel === c) {
      this.covSel = null;
      return;
    }
    this.covSel = c;
    const b = this.eng.bands(c);
    this.covBands = b.bands;
    this.covTicks = b.ticks;
    this.covAxis = b.axisMax;
    this.covDemand = c.demand.map((d) => ({ ...d, left: Math.min(100, (d.qty / b.axisMax) * 100) }));
    if (!this.covProbe) this.covProbe = Math.round((c.eligible[0]?.min ?? c.demand[0]?.qty ?? 0) || 0);
    this.probe(this.covProbe);
  }

  probe(v: number | string): void {
    this.covProbe = Number(v) || 0;
    const w = this.covSel && this.eng ? this.eng.winnerAt(this.covSel, this.covProbe) : null;
    this.covWinner = w ? `${w.code} — ${w.title} (اولویت ${faInt(w.priority)}، روش ${w.routingCode})` : 'هیچ نسخه‌ای این مقدار را پوشش نمی‌دهد';
  }

  productTitle(pid: number): string {
    return this.products.find((p) => p.id === pid)?.title ?? '';
  }

  lineTitle(lid: number): string {
    return this.lines.find((l) => l.id === lid)?.title ?? '';
  }

  // ───────── ۵) بیرونی و هزینه ─────────

  private recomputeExternal(): void {
    const e = this.eng;
    if (!e) return;
    this.risks = e.contractorRisk();
    this.outOps = e.outsourcedOps(this.scopedIds);
    this.costRows = e.costRows(this.scopedIds);
  }

  // ───────── ۶) بدهی ─────────

  private recomputeDebt(): void {
    const e = this.eng;
    if (!e) return;
    const all = e.debt(this.scopedIds);
    this.debtItems = all;
    this.debtTotal = all.reduce((a, x) => a + x.impact, 0);
    this.debtPlanned = all.filter((x) => this.fixed.has(x.d.key)).reduce((a, x) => a + x.impact, 0);
    this.debtGroups = e.group(all, this.debtBy, (k) => this.groupLabel(k));
    const m = new Map<string, { impact: number; count: number }>();
    for (const x of all) {
      const o = m.get(x.owner) ?? { impact: 0, count: 0 };
      o.impact += x.impact;
      o.count++;
      m.set(x.owner, o);
    }
    this.owners = [...m.entries()].map(([owner, v]) => ({ owner, ...v })).sort((a, b) => b.impact - a.impact);
  }

  private groupLabel(k: string): string {
    if (this.debtBy === 'cat') return CAT_LABEL[k] ?? k;
    return k;
  }

  setDebtBy(by: DebtBy): void {
    this.debtBy = by;
    this.debtOpen = null;
    this.recomputeDebt();
  }

  toggleGroup(k: string): void {
    this.debtOpen = this.debtOpen === k ? null : k;
  }

  planTop(n: number): void {
    const s = new Set(this.fixed);
    for (const x of this.debtItems.slice(0, n)) s.add(x.d.key);
    this.fixed = s;
    this.recomputeHealth();
    this.recomputeDebt();
    this.updateBanner();
  }

  focusRouting(id: number | null): void {
    if (id === null) return;
    if (!this.healthById.has(id)) {
      this.showAll = true;
      this.recompute();
    }
    this.pickRouting(id);
    this.space = 'map';
  }

  // ───────── بنر ─────────

  private updateBanner(): void {
    const crit = this.debtItems.filter((x) => x.d.sev === 3 && !this.fixed.has(x.d.key));
    const worst = this.healths.filter((h) => !h.routing.isTemplate)[0];
    const parts: string[] = [];
    if (worst) parts.push(`سلامت میانگین ${faInt(this.avgHealth)}؛ ضعیف‌ترین ${worst.routing.code} ${worst.routing.version} (${faInt(worst.score)})`);
    if (crit.length) parts.push(`${faInt(crit.length)} نقص بحرانی — اول: ${crit[0].d.title}`);
    const bn = this.simBase?.bottleneck;
    if (bn) parts.push(`گلوگاه تقاضای باز: ${bn.title} ${bn.utilLabel}`);
    if (this.covGaps) parts.push(`${faInt(this.covGaps)} خانه‌ی کالا×خط بی‌نسخه‌ی عادی`);
    this.bannerText = parts.join('   ·   ') || 'در این دامنه نقصی دیده نمی‌شود.';
    this.bannerTone = crit.length ? 'danger' : parts.length > 1 ? 'warning' : 'success';
  }

  ds(key: string, label: string): DataSourceInfo {
    return { key, label, filterVal: this.companyId };
  }

  trackId(_: number, x: { id: number }): number {
    return x.id;
  }
}
