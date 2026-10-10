import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { fa } from '../rm/rm-time';
import {
  AttributeDefRow,
  DimensionRow,
  ItemAttributeRow,
  ItemDimensionRow,
  ItemIssue,
  ItemRow,
  LotSizeRow,
  PolicyRow,
  ROLE_LABEL,
  SOURCE_LABEL,
  TRACKING_LABEL,
  VariantRow,
} from './frm-pe-01.data';

interface ItemApiRow {
  ProductId: number;
  Code: string;
  Title: string;
  UnitTitle: string;
  ProductGroupTitle: string | null;
  ProductionItemId: number | null;
  ProductionRoleCode: number | null;
  TrackingLevelCode: number | null;
  IsTrackingMandatory: boolean | null;
  IsPhantom: boolean | null;
  IsDimensional: boolean | null;
  Description: string | null;
  PolicyCount: number;
  IsMade: boolean;
  HasNonMakePolicy: boolean;
  AttributeCount: number;
  LotSizeCount: number;
  VariantCount: number;
}
interface PolicyApiRow {
  ProductId: number;
  ProductCode: string;
  ProductTitle: string;
  IsPhantom: boolean;
  ProductSourceCode: number;
  Priority: number;
  SharePercent: number | null;
  ContractorCode: string | null;
  ContractorTitle: string | null;
  ContractorQualificationCode: number | null;
  ContractorIsActive: boolean | null;
  SourceSiteTitle: string | null;
  Description: string | null;
}
interface AttributeApiRow {
  Code: string;
  Title: string;
  UnitTitle: string | null;
  AttributeDataTypeCode: number;
  ItemCount: number;
  Description: string | null;
}
interface ItemAttributeApiRow {
  ProductCode: string;
  ProductTitle: string;
  AttributeTitle: string;
  UnitTitle: string | null;
  AttributeDataTypeCode: number;
  NominalValue: number | null;
  MinValue: number | null;
  MaxValue: number | null;
  TextValue: string | null;
  Description: string | null;
}
interface DimensionApiRow {
  DimensionId: number;
  DimensionCode: string;
  DimensionTitle: string;
  ValueCode: string | null;
  ValueTitle: string | null;
  ItemCount: number;
}
interface ItemDimensionApiRow {
  ProductCode: string;
  ProductTitle: string;
  DimensionTitle: string;
  ValueTitle: string;
}
interface VariantApiRow {
  ProductCode: string;
  ProductTitle: string;
  VariantCode: string;
  VariantTitle: string;
  IsActive: boolean;
}
interface LotSizeApiRow {
  ProductCode: string;
  ProductTitle: string;
  UnitTitle: string;
  LineTitle: string | null;
  BatchSize: number;
  MinOrderQuantity: number | null;
  MaxOrderQuantity: number | null;
  OrderMultiple: number | null;
  Description: string | null;
}
interface BundleApi {
  items: ItemApiRow[];
  policies: PolicyApiRow[];
  attributes: AttributeApiRow[];
  itemAttributes: ItemAttributeApiRow[];
  dimensions: DimensionApiRow[];
  itemDimensionValues: ItemDimensionApiRow[];
  variants: VariantApiRow[];
  lotSizes: LotSizeApiRow[];
}

/** همه‌ی داده‌ی فرم برای یک کالا (یا همه). */
export interface FrmPe01Bundle {
  items: ItemRow[];
  policies: PolicyRow[];
  attributeDefs: AttributeDefRow[];
  itemAttributes: ItemAttributeRow[];
  dimensions: DimensionRow[];
  itemDimensions: ItemDimensionRow[];
  variants: VariantRow[];
  lotSizes: LotSizeRow[];
  issues: ItemIssue[];
}

const DATA_TYPE_LABEL: Record<number, string> = { 1: 'عددی', 2: 'بازه', 3: 'متنی' };
const product = (code: string, title: string) => `${code} — ${title}`;
const qty = (n: number | null, unit: string) => (n === null ? '—' : `${fa(n)} ${unit}`);

/**
 * داده‌ی واقعی FRM-PE-01 را از gng-mfr-api می‌گیرد (SP های اسکیمای mes — به
 * scripts/mes_frm_pe01_setup.sql نگاه کنید).
 */
@Injectable({ providedIn: 'root' })
export class FrmPe01Service {
  constructor(private http: HttpClient) {}

  load(productId: number | null, companyId = DEMO_COMPANY_ID): Observable<FrmPe01Bundle> {
    const params: Record<string, number> = { companyId };
    if (productId !== null) params['productId'] = productId;
    return this.http.get<BundleApi>(`${API_BASE_URL}/api/pe01/bundle`, { params }).pipe(map((b) => this.build(b, productId)));
  }

  private build(b: BundleApi, productId: number | null): FrmPe01Bundle {
    const issues: ItemIssue[] = [];
    for (const i of b.items.filter((x) => x.ProductionItemId !== null && (productId === null || x.ProductId === productId))) {
      const name = product(i.Code, i.Title);
      const role = i.ProductionRoleCode ?? 0;
      if ((role === 1 || role === 2) && !i.IsPhantom && i.TrackingLevelCode === 0) {
        issues.push({ productId: i.ProductId, tone: 'danger', text: `${name}: ${ROLE_LABEL[role]} بدون ردیابی بچ (الزام GMP)` });
      }
      if (i.IsPhantom && i.TrackingLevelCode !== 0) {
        issues.push({ productId: i.ProductId, tone: 'warning', text: `${name}: فانتوم موجودی ندارد ولی ردیابی «${TRACKING_LABEL[i.TrackingLevelCode ?? 0]}» دارد` });
      }
      if (i.IsPhantom && i.HasNonMakePolicy) {
        issues.push({ productId: i.ProductId, tone: 'warning', text: `${name}: فانتوم فقط تولید داخلی می‌شود ولی سیاست تأمین دیگری دارد` });
      }
      if (i.IsMade && !i.IsPhantom && !i.LotSizeCount) {
        issues.push({ productId: i.ProductId, tone: 'warning', text: `${name}: تولید داخلی دارد ولی اندازه‌ی بچ تعریف نشده` });
      }
      if (i.IsDimensional && !i.VariantCount) {
        issues.push({ productId: i.ProductId, tone: 'warning', text: `${name}: ابعادی است ولی ترکیبی ساخته نشده` });
      }
    }
    for (const p of b.policies.filter((x) => x.ProductSourceCode === 3 && x.ContractorTitle)) {
      if (p.ContractorQualificationCode === 3 || p.ContractorIsActive === false) {
        issues.push({
          productId: p.ProductId,
          tone: 'warning',
          text: `${product(p.ProductCode, p.ProductTitle)}: برون‌سپاری به «${p.ContractorTitle}» که ${p.ContractorIsActive === false ? 'غیرفعال' : 'در تعلیق'} است`,
        });
      }
    }

    const policyText = (rows: PolicyApiRow[]) =>
      rows.sort((a, c) => a.Priority - c.Priority).map((r) => SOURCE_LABEL[r.ProductSourceCode]).join(' ← ') || '—';

    const dims = new Map<number, DimensionRow>();
    for (const d of b.dimensions) {
      if (!dims.has(d.DimensionId)) dims.set(d.DimensionId, { code: d.DimensionCode, title: d.DimensionTitle, values: [] });
      if (d.ValueCode) dims.get(d.DimensionId)!.values.push({ code: d.ValueCode, title: d.ValueTitle ?? '', used: d.ItemCount > 0 });
    }
    const itemDims = new Map<string, ItemDimensionRow>();
    for (const d of b.itemDimensionValues) {
      const key = `${d.ProductCode}|${d.DimensionTitle}`;
      const row = itemDims.get(key) ?? { product: product(d.ProductCode, d.ProductTitle), dimension: d.DimensionTitle, values: '' };
      row.values = row.values ? `${row.values}، ${d.ValueTitle}` : d.ValueTitle;
      itemDims.set(key, row);
    }

    return {
      items: b.items.map((i): ItemRow => ({
        productId: i.ProductId,
        code: i.Code,
        title: i.Title,
        unit: i.UnitTitle,
        group: i.ProductGroupTitle ?? '—',
        hasRole: i.ProductionItemId !== null,
        roleCode: i.ProductionRoleCode,
        role: i.ProductionRoleCode ? ROLE_LABEL[i.ProductionRoleCode] : 'بدون نقش تولیدی',
        tracking: i.TrackingLevelCode === null ? '—' : TRACKING_LABEL[i.TrackingLevelCode],
        trackingCode: i.TrackingLevelCode,
        trackingMandatory: !!i.IsTrackingMandatory,
        isPhantom: !!i.IsPhantom,
        isDimensional: !!i.IsDimensional,
        policySummary: policyText(b.policies.filter((p) => p.ProductId === i.ProductId)),
        attributeCount: i.AttributeCount,
        lotSizeCount: i.LotSizeCount,
        variantCount: i.VariantCount,
        description: i.Description ?? '',
      })),
      policies: b.policies.map((p) => {
        const bad = p.ProductSourceCode === 3 && (p.ContractorQualificationCode === 3 || p.ContractorIsActive === false);
        return {
          product: product(p.ProductCode, p.ProductTitle),
          priority: p.Priority,
          source: SOURCE_LABEL[p.ProductSourceCode] ?? '—',
          sourceCode: p.ProductSourceCode,
          partner: p.ContractorTitle ? `${p.ContractorCode} — ${p.ContractorTitle}` : p.SourceSiteTitle ?? '—',
          share: p.SharePercent === null ? '—' : `${fa(p.SharePercent)}٪`,
          warning: bad ? (p.ContractorIsActive === false ? 'پیمانکار غیرفعال' : 'پیمانکار در تعلیق') : '',
          description: p.Description ?? '',
        };
      }),
      attributeDefs: b.attributes.map((a) => ({
        code: a.Code,
        title: a.Title,
        unit: a.UnitTitle ?? '—',
        dataType: DATA_TYPE_LABEL[a.AttributeDataTypeCode] ?? '—',
        itemCount: a.ItemCount,
        description: a.Description ?? '',
      })),
      itemAttributes: b.itemAttributes.map((a) => {
        const unit = a.UnitTitle ?? '';
        let value: string;
        if (a.TextValue) value = a.TextValue;
        else if (a.MinValue !== null || a.MaxValue !== null) {
          const range =
            a.MinValue !== null && a.MaxValue !== null
              ? `${fa(a.MinValue)} تا ${fa(a.MaxValue)}`
              : a.MaxValue !== null
                ? `حداکثر ${fa(a.MaxValue)}`
                : `حداقل ${fa(a.MinValue!)}`;
          value = `${a.NominalValue !== null ? `${fa(a.NominalValue)} (${range})` : range} ${unit}`.trim();
        } else value = a.NominalValue === null ? '—' : `${fa(a.NominalValue)} ${unit}`.trim();
        return { product: product(a.ProductCode, a.ProductTitle), attribute: a.AttributeTitle, value, description: a.Description ?? '' };
      }),
      dimensions: [...dims.values()],
      itemDimensions: [...itemDims.values()],
      variants: b.variants.map((v) => ({
        product: product(v.ProductCode, v.ProductTitle),
        code: v.VariantCode,
        title: v.VariantTitle,
        active: v.IsActive,
      })),
      lotSizes: b.lotSizes.map((l) => ({
        product: product(l.ProductCode, l.ProductTitle),
        line: l.LineTitle ?? 'همه‌ی خطوط',
        batch: qty(l.BatchSize, l.UnitTitle),
        min: qty(l.MinOrderQuantity, l.UnitTitle),
        max: qty(l.MaxOrderQuantity, l.UnitTitle),
        multiple: qty(l.OrderMultiple, l.UnitTitle),
        description: l.Description ?? '',
      })),
      issues,
    };
  }
}
