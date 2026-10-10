import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID, LEVEL_LABELS } from '../rm/rm-scope';
import { fa, faFullDate, isoDay } from '../rm/rm-time';
import {
  APPROVAL,
  AttachmentRow,
  DOC_TYPE_LABEL,
  DiffRow,
  EFFECTIVITY_LABEL,
  ItemRow,
  PercentCheck,
  QTYPE_LABEL,
  REVISION_STATUS,
  RevisionRow,
  ScopeRow,
  StructureRow,
  TYPE_LABEL,
  TransitionRow,
  TypeChangeRow,
} from './frm-pe-02.data';

interface StructureApiRow {
  StructureId: number;
  Code: string;
  Title: string;
  ProductId: number | null;
  ProductCode: string | null;
  ProductTitle: string | null;
  ProductUnit: string | null;
  ProductHasRole: boolean;
  TypeCode: number;
  StatusCode: number | null;
  IsDefault: boolean;
  GroupTitle: string | null;
  ProfileCode: string | null;
  License: string | null;
  BaseQuantity: number | null;
  MinimumQuantity: number | null;
  MaximumQuantity: number | null;
  BatchMultiple: number | null;
  AllowPercentOver100: boolean;
  ValidFromDate: string;
  ValidToDate: string | null;
  IsProductionByOrder: boolean | null;
  RevisionId: number;
  RevisionCode: string | null;
  TemplateCode: string | null;
  TemplateTitle: string | null;
  ItemCount: number;
  ChildCount: number;
  ScopeSummary: string | null;
  PendingTypeChanges: number;
  Description: string | null;
}
interface ItemApiRow {
  ItemId: number;
  Source: string;
  SourceStructureCode: string | null;
  Sequence: number;
  ProductId: number;
  ProductCode: string;
  ProductTitle: string;
  StockUnit: string;
  IsPhantom: boolean | null;
  ItemRoleTitle: string | null;
  QuantityTypeCode: number;
  Quantity: number;
  QuantityFormula: string | null;
  IsQuantumSatis: boolean;
  QuantityAtBase: number | null;
  IsActiveIngredient: boolean | null;
  AssayBasisPercent: number | null;
  CompensationCode: string | null;
  CompensationTitle: string | null;
  AssayMin: number | null;
  WastePercent: number | null;
  WasteTypeCode: number | null;
  WasteQuantity: number | null;
  IsWastePriorityOverOperation: boolean;
  MinConsumptionPercent: number | null;
  MaxConsumptionPercent: number | null;
  ConsumptionUnitTitle: string | null;
  UnitConversionFactor: number | null;
  IsBatchDependentConversion: boolean;
  Description: string | null;
}
interface RevisionApiRow {
  RevisionId: number;
  RevisionCode: string;
  RevisionStatusCode: number;
  EffectivityTypeCode: number;
  ValidFromDate: string | null;
  ValidToDate: string | null;
  FromBatchNumber: string | null;
  ToBatchNumber: string | null;
  WorkOrderNumber: string | null;
  ApproverTitle: string | null;
  EcoNumber: string | null;
  Description: string | null;
  IsCurrent: boolean;
  OwnItemCount: number;
}
interface ScopeApiRow {
  LevelCode: string | null;
  ScopeTitle: string;
  ValidFromDate: string;
  ValidToDate: string | null;
  Description: string | null;
}
interface TypeChangeApiRow {
  FromTypeCode: number;
  ToTypeCode: number;
  RequestDate: string;
  RequestedByTitle: string | null;
  ApprovalStatusCode: number;
  QcApproverTitle: string | null;
  ManagerApproverTitle: string | null;
  Description: string | null;
}
interface TransitionApiRow {
  FromTypeCode: number;
  ToTypeCode: number;
  RequiredApproval: string;
}
interface AttachmentApiRow {
  DocumentTypeCode: number;
  Title: string;
  DocumentNumber: string | null;
  FileName: string | null;
  ValidFromDate: string | null;
  ValidToDate: string | null;
  DaysLeft: number | null;
  IsLinked: boolean;
}
interface DetailApi {
  items: ItemApiRow[];
  revisions: RevisionApiRow[];
  scopes: ScopeApiRow[];
  typeChanges: TypeChangeApiRow[];
  transitions: TransitionApiRow[];
  attachments: AttachmentApiRow[];
}
interface DiffApiRow {
  ProductCode: string;
  ProductTitle: string;
  StockUnit: string;
  DiffStatus: DiffRow['status'];
  ChangedFields: string | null;
  LeftQuantityTypeCode: number | null;
  LeftQuantity: number | null;
  LeftWastePercent: number | null;
  RightQuantityTypeCode: number | null;
  RightQuantity: number | null;
  RightWastePercent: number | null;
}

/** جزئیات یک ساختار در یک نسخه. */
export interface FrmPe02Detail {
  items: ItemRow[];
  removed: ItemRow[];
  percent: PercentCheck;
  revisions: RevisionRow[];
  scopes: ScopeRow[];
  typeChanges: TypeChangeRow[];
  transitions: TransitionRow[];
  attachments: AttachmentRow[];
}

const LICENSE_WARN_DAYS = 60;
const day = (v: string | null) => (v ? faFullDate(isoDay(v)) : '');
const period = (from: string | null, to: string | null) =>
  from && to ? `${day(from)} تا ${day(to)}` : from ? `از ${day(from)}` : to ? `تا ${day(to)}` : '—';
const round = (n: number, digits = 3) => Math.round(n * 10 ** digits) / 10 ** digits;

/**
 * داده‌ی واقعی FRM-PE-02 را از gng-mfr-api می‌گیرد (SP های اسکیمای mes — به
 * scripts/mes_frm_pe02_setup.sql نگاه کنید).
 */
@Injectable({ providedIn: 'root' })
export class FrmPe02Service {
  constructor(private http: HttpClient) {}

  listStructures(companyId = DEMO_COMPANY_ID): Observable<StructureRow[]> {
    return this.http
      .get<StructureApiRow[]>(`${API_BASE_URL}/api/pe02/structures`, { params: { companyId } })
      .pipe(map((rows) => rows.map((r) => this.structure(r))));
  }

  loadStructure(s: StructureRow, revisionId: number | null): Observable<FrmPe02Detail> {
    const params: Record<string, number> = {};
    if (revisionId !== null) params['revisionId'] = revisionId;
    return this.http
      .get<DetailApi>(`${API_BASE_URL}/api/pe02/structures/${s.id}`, { params })
      .pipe(map((d) => this.detail(s, d)));
  }

  diff(left: string, right: string): Observable<DiffRow[]> {
    const [l, lr] = left.split('|');
    const [r, rr] = right.split('|');
    const params: Record<string, string> = { left: l, right: r };
    if (lr) params['leftRevision'] = lr;
    if (rr) params['rightRevision'] = rr;
    return this.http.get<DiffApiRow[]>(`${API_BASE_URL}/api/pe02/diff`, { params }).pipe(
      map((rows) =>
        rows.map((d) => ({
          product: `${d.ProductCode} — ${d.ProductTitle}`,
          status: d.DiffStatus,
          fields: (d.ChangedFields ?? '').replace(/،\s*$/, ''),
          left: this.diffSide(d.LeftQuantityTypeCode, d.LeftQuantity, d.LeftWastePercent, d.StockUnit),
          right: this.diffSide(d.RightQuantityTypeCode, d.RightQuantity, d.RightWastePercent, d.StockUnit),
        }))
      )
    );
  }

  /** خروجی ردیف‌ها به CSV با BOM، که اکسل با حروف فارسی درست باز می‌کند (نیمه‌ی خروجی F-PE-068). */
  exportCsv(s: StructureRow, revisionCode: string, items: ItemRow[]): void {
    const header = ['ردیف', 'کد کالا', 'قلم مصرفی', 'نقش', 'منشأ', 'نوع مقدار', 'مقدار تعریف‌شده', 'درصد', 'مقدار در اندازه‌ی مرجع',
      'واحد انبار', 'عیار', 'ضایعات', 'محدوده‌ی مصرف', 'واحد مصرف', 'شرح'];
    const rows = items.map((i) => [i.seq, i.product.split(' — ')[0], i.product.split(' — ').slice(1).join(' — '), i.role, i.source,
      i.quantityType, i.defined, i.percent ?? '', i.atBase, i.stockUnit, i.assay, i.waste, i.range, i.unitConversion, i.description]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${s.code}-${revisionCode}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---- ساخت ردیف‌های نمایش ----

  private structure(r: StructureApiRow): StructureRow {
    const unit = r.ProductUnit ?? '';
    const range =
      r.MinimumQuantity !== null || r.MaximumQuantity !== null
        ? `${r.MinimumQuantity !== null ? fa(r.MinimumQuantity) : '—'} تا ${r.MaximumQuantity !== null ? fa(r.MaximumQuantity) : '—'} ${unit}` +
          (r.BatchMultiple ? `، مضرب ${fa(r.BatchMultiple)}` : '')
        : '—';
    return {
      id: r.StructureId,
      code: r.Code,
      title: r.Title,
      productId: r.ProductId,
      product: r.ProductCode ? `${r.ProductCode} — ${r.ProductTitle}` : 'بدون محصول (الگو)',
      productUnit: unit,
      productHasRole: r.ProductHasRole,
      typeCode: r.TypeCode,
      isTemplate: r.TypeCode === 3,
      statusCode: r.StatusCode ?? 1,
      isDefault: r.IsDefault,
      group: r.GroupTitle ?? '—',
      profile: r.ProfileCode === 'PHARMA' ? 'دارویی' : r.ProfileCode ?? '—',
      license: r.License ?? '—',
      baseQuantity: r.BaseQuantity,
      batchRange: range,
      allowOver100: r.AllowPercentOver100,
      validity: period(r.ValidFromDate, r.ValidToDate),
      revisionId: r.RevisionId,
      revisionCode: r.RevisionCode ?? '—',
      template: r.TemplateCode ? `${r.TemplateCode} — ${r.TemplateTitle}` : '',
      itemCount: r.ItemCount,
      childCount: r.ChildCount,
      scope: r.ScopeSummary ?? 'همه‌ی واحدها',
      byOrder: !!r.IsProductionByOrder,
      pendingTypeChanges: r.PendingTypeChanges,
      description: r.Description ?? '',
    };
  }

  private detail(s: StructureRow, d: DetailApi): FrmPe02Detail {
    const base = s.baseQuantity ?? 0;
    const live = d.items.filter((i) => i.Source !== 'removed');
    const pctRows = live.filter((i) => i.QuantityTypeCode === 4 && !i.IsQuantumSatis);
    const qsRows = live.filter((i) => i.IsQuantumSatis);
    const sum = round(pctRows.reduce((t, i) => t + i.Quantity, 0), 4);
    const qsShare = qsRows.length ? round(Math.max(100 - sum, 0), 4) : 0;
    const total = round(sum + qsShare, 4);

    const toRow = (i: ItemApiRow): ItemRow => {
      const unit = i.StockUnit;
      let defined: string;
      let percent: number | null = null;
      let atBase = '—';
      if (i.IsQuantumSatis) {
        percent = qsShare;
        defined = 'q.s. (به مقدار کافی)';
        atBase = base ? `${fa(round((base * qsShare) / 100))} ${unit}` : '—';
      } else if (i.QuantityTypeCode === 4) {
        percent = i.Quantity;
        defined = `${fa(i.Quantity)}٪`;
        atBase = i.QuantityAtBase !== null ? `${fa(round(i.QuantityAtBase))} ${unit}` : '—';
      } else if (i.QuantityTypeCode === 3) {
        defined = i.QuantityFormula ?? 'فرمول ثبت نشده';
        atBase = 'هنگام دستور تولید';
      } else {
        defined = `${fa(i.Quantity)} ${unit}`;
        atBase = i.QuantityAtBase !== null ? `${fa(round(i.QuantityAtBase))} ${unit}` : '—';
      }

      let assay = '';
      if (i.IsActiveIngredient && i.AssayBasisPercent) {
        assay = `نظری بر مبنای عیار ${fa(i.AssayBasisPercent)}٪`;
        if (i.AssayMin && i.QuantityAtBase !== null) {
          const actual = (i.QuantityAtBase * i.AssayBasisPercent) / i.AssayMin;
          assay += `؛ در عیار ${fa(i.AssayMin)}٪ ← ${fa(round(actual))} ${unit}`;
          if (i.CompensationTitle) assay += `، و ${fa(round(actual - i.QuantityAtBase))} ${unit} از «${i.CompensationTitle}» کم می‌شود`;
        }
      }
      const waste =
        i.WastePercent !== null
          ? `${fa(i.WastePercent)}٪`
          : i.WasteQuantity !== null
            ? `${fa(i.WasteQuantity)} ${unit}`
            : '—';
      const range =
        i.MinConsumptionPercent !== null || i.MaxConsumptionPercent !== null
          ? `${fa(i.MinConsumptionPercent ?? 0)}٪ تا ${fa(i.MaxConsumptionPercent ?? 0)}٪`
          : '—';
      const conv =
        i.ConsumptionUnitTitle && i.UnitConversionFactor
          ? `۱ ${i.ConsumptionUnitTitle} = ${i.UnitConversionFactor.toLocaleString('fa-IR', { maximumFractionDigits: 6 })} ${unit}${i.IsBatchDependentConversion ? ' (وابسته به بچ)' : ''}`
          : '—';
      return {
        key: `${i.Source}-${i.ItemId}`,
        source: i.Source,
        sourceCode: i.SourceStructureCode ?? '',
        seq: i.Sequence,
        productId: i.ProductId,
        product: `${i.ProductCode} — ${i.ProductTitle}`,
        stockUnit: unit,
        isPhantom: !!i.IsPhantom,
        role: i.ItemRoleTitle ?? '—',
        quantityType: i.IsQuantumSatis ? 'q.s.' : QTYPE_LABEL[i.QuantityTypeCode] ?? '—',
        quantityTypeCode: i.QuantityTypeCode,
        defined,
        percent,
        atBase,
        isQs: i.IsQuantumSatis,
        isActive: !!i.IsActiveIngredient,
        assay,
        waste: waste + (waste !== '—' && !i.IsWastePriorityOverOperation ? ' (ضایعات فرایند اولویت دارد)' : ''),
        range,
        unitConversion: conv,
        description: i.Description ?? '',
      };
    };

    let percent: PercentCheck;
    if (!pctRows.length && !qsRows.length) {
      percent = { applies: false, sum: 0, qsShare: 0, total: 0, ok: true, tone: 'secondary', text: '' };
    } else if (qsRows.length && sum > 100) {
      percent = { applies: true, sum, qsShare: 0, total: sum, ok: false, tone: 'danger',
        text: `جمع اجزای درصدی ${fa(sum)}٪ است و برای q.s. جایی نمی‌ماند.` };
    } else if (Math.abs(total - 100) < 0.0001) {
      percent = { applies: true, sum, qsShare, total, ok: true, tone: 'success',
        text: qsShare ? `جمع اجزا ${fa(sum)}٪ و q.s. ${fa(qsShare)}٪ — جمع ۱۰۰٪.` : 'جمع درصد اجزا دقیقاً ۱۰۰٪ است.' };
    } else if (total > 100 && s.allowOver100) {
      percent = { applies: true, sum, qsShare, total, ok: true, tone: 'warning',
        text: `جمع درصد ${fa(total)}٪ است؛ بیش از ۱۰۰٪ برای این ساختار مجاز شده.` };
    } else {
      percent = { applies: true, sum, qsShare, total, ok: false, tone: 'danger',
        text: `جمع درصد اجزا ${fa(total)}٪ است، نه ۱۰۰٪ (${total < 100 ? 'کمبود' : 'مازاد'} ${fa(round(Math.abs(100 - total), 4))}٪).` };
    }

    const types = (from: number, to: number) => `${TYPE_LABEL[from] ?? from} ← ${TYPE_LABEL[to] ?? to}`;
    return {
      items: live.map(toRow),
      removed: d.items.filter((i) => i.Source === 'removed').map(toRow),
      percent,
      revisions: d.revisions.map((r) => {
        const st = REVISION_STATUS[r.RevisionStatusCode] ?? { label: '—', tone: 'secondary' as const };
        let range: string;
        if (r.EffectivityTypeCode === 2) {
          range = r.FromBatchNumber && r.ToBatchNumber ? `بچ ${r.FromBatchNumber} تا ${r.ToBatchNumber}`
            : r.FromBatchNumber ? `از بچ ${r.FromBatchNumber}` : r.ToBatchNumber ? `تا بچ ${r.ToBatchNumber}` : '—';
        } else if (r.EffectivityTypeCode === 3) {
          range = r.WorkOrderNumber ? `فقط دستور ${r.WorkOrderNumber}` : '—';
        } else range = period(r.ValidFromDate, r.ValidToDate);
        return {
          revisionId: r.RevisionId,
          code: r.RevisionCode,
          status: st.label,
          statusTone: st.tone,
          effectivity: EFFECTIVITY_LABEL[r.EffectivityTypeCode] ?? '—',
          range,
          approver: r.ApproverTitle ?? '—',
          eco: r.EcoNumber ?? '—',
          description: r.Description ?? '',
          isCurrent: r.IsCurrent,
          ownItemCount: r.OwnItemCount,
        };
      }),
      scopes: d.scopes.map((sc) => ({
        level: sc.LevelCode ? LEVEL_LABELS[sc.LevelCode] ?? sc.LevelCode : '—',
        title: sc.ScopeTitle,
        validity: period(sc.ValidFromDate, sc.ValidToDate),
        description: sc.Description ?? '',
      })),
      typeChanges: d.typeChanges.map((t) => {
        const a = APPROVAL[t.ApprovalStatusCode] ?? { label: '—', tone: 'secondary' as const };
        return {
          from: TYPE_LABEL[t.FromTypeCode] ?? '—',
          to: TYPE_LABEL[t.ToTypeCode] ?? '—',
          requested: `${day(t.RequestDate)} — ${t.RequestedByTitle ?? ''}`,
          status: a.label,
          statusTone: a.tone,
          approvers: [t.QcApproverTitle, t.ManagerApproverTitle].filter(Boolean).join('، ') || '—',
          description: t.Description ?? '',
        };
      }),
      transitions: d.transitions.map((t) => ({
        from: TYPE_LABEL[t.FromTypeCode] ?? '—',
        to: TYPE_LABEL[t.ToTypeCode] ?? '—',
        approval: t.RequiredApproval,
        fromCurrent: t.FromTypeCode === s.typeCode,
      })),
      attachments: d.attachments.map((a) => {
        let state = 'بدون تاریخ انقضا';
        let tone: AttachmentRow['stateTone'] = 'secondary';
        if (a.DaysLeft !== null) {
          if (a.DaysLeft < 0) [state, tone] = ['منقضی', 'danger'];
          else if (a.DaysLeft <= LICENSE_WARN_DAYS) [state, tone] = [`${fa(a.DaysLeft)} روز مانده`, 'warning'];
          else [state, tone] = ['معتبر', 'success'];
        }
        return {
          type: DOC_TYPE_LABEL[a.DocumentTypeCode] ?? '—',
          title: a.Title,
          number: a.DocumentNumber ?? '—',
          fileName: a.FileName ?? '—',
          validity: period(a.ValidFromDate, a.ValidToDate),
          state,
          stateTone: tone,
          linked: a.IsLinked,
        };
      }),
    };
  }

  private diffSide(type: number | null, qty: number | null, waste: number | null, unit: string): string {
    if (type === null || qty === null) return '—';
    const q = type === 4 ? `${fa(qty)}٪` : type === 3 ? 'فرمولی' : `${fa(qty)} ${unit}`;
    return waste !== null ? `${q} · ضایعات ${fa(waste)}٪` : q;
  }
}
