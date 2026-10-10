import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { fa } from '../rm/rm-time';
import { DerivedMatrix, MatrixItem, MatrixStructure } from './frm-pe-06.data';

interface StructureApiRow {
  StructureId: number;
  Code: string;
  Title: string;
  ProductCode: string;
  ProductTitle: string;
  UnitTitle: string;
  BaseQuantity: number;
  RevisionCode: string | null;
  Dimensions: string | null;
  VariantCount: number;
  DependentItems: number;
  IndependentItems: number;
}
interface ItemApiRow {
  ItemId: number;
  Sequence: number;
  ProductCode: string;
  ProductTitle: string;
  UnitTitle: string;
  ItemRoleTitle: string | null;
  BaseRowQuantity: number;
  DimensionTitle: string | null;
  ValueCode: string | null;
  ValueTitle: string | null;
  MatrixQuantity: number | null;
}
interface DerivedApiRow {
  VariantCode: string;
  VariantTitle: string;
  ItemId: number;
  Sequence: number;
  ProductTitle: string;
  UnitTitle: string;
  Quantity: number | null;
  IsDependent: boolean;
}
interface BundleApi {
  structureId: number | null;
  structures: StructureApiRow[];
  items: ItemApiRow[];
  derived: DerivedApiRow[];
}

export interface FrmPe06Bundle {
  structureId: number | null;
  structures: MatrixStructure[];
  items: MatrixItem[];
  derived: DerivedMatrix;
}

/**
 * داده‌ی واقعی FRM-PE-06 را از gng-mfr-api می‌گیرد (SP های اسکیمای mes — به
 * scripts/mes_frm_pe06_setup.sql نگاه کنید).
 */
@Injectable({ providedIn: 'root' })
export class FrmPe06Service {
  constructor(private http: HttpClient) {}

  load(structureId: number | null, companyId = DEMO_COMPANY_ID): Observable<FrmPe06Bundle> {
    const params: Record<string, number> = { companyId };
    if (structureId !== null) params['structureId'] = structureId;
    return this.http.get<BundleApi>(`${API_BASE_URL}/api/pe06/bundle`, { params }).pipe(
      map((b) => {
        const items = new Map<number, MatrixItem>();
        for (const r of b.items) {
          if (!items.has(r.ItemId)) {
            items.set(r.ItemId, {
              itemId: r.ItemId,
              seq: r.Sequence,
              product: `${r.ProductCode} — ${r.ProductTitle}`,
              unit: r.UnitTitle,
              role: r.ItemRoleTitle ?? '—',
              baseQuantity: r.BaseRowQuantity,
              dimension: r.DimensionTitle,
              values: [],
            });
          }
          if (r.ValueCode) items.get(r.ItemId)!.values.push({ code: r.ValueCode, title: r.ValueTitle ?? '', quantity: r.MatrixQuantity });
        }

        const itemCols = new Map<number, { itemId: number; label: string; unit: string; dependent: boolean }>();
        const variants = new Map<string, { code: string; title: string; byItem: Map<number, number | null> }>();
        for (const d of b.derived) {
          if (!itemCols.has(d.ItemId)) itemCols.set(d.ItemId, { itemId: d.ItemId, label: d.ProductTitle, unit: d.UnitTitle, dependent: d.IsDependent });
          if (!variants.has(d.VariantCode)) variants.set(d.VariantCode, { code: d.VariantCode, title: d.VariantTitle, byItem: new Map() });
          variants.get(d.VariantCode)!.byItem.set(d.ItemId, d.Quantity);
        }
        const cols = [...itemCols.values()];
        return {
          structureId: b.structureId,
          structures: b.structures.map((s) => ({
            id: s.StructureId,
            code: s.Code,
            title: s.Title,
            product: `${s.ProductCode} — ${s.ProductTitle}`,
            base: `${fa(s.BaseQuantity)} ${s.UnitTitle}`,
            revision: s.RevisionCode ?? '—',
            dimensions: s.Dimensions ?? '—',
            variantCount: s.VariantCount,
            dependentItems: s.DependentItems,
            independentItems: s.IndependentItems,
          })),
          items: [...items.values()],
          derived: {
            items: cols,
            variants: [...variants.values()].map((v) => {
              const quantities = cols.map((c) => v.byItem.get(c.itemId) ?? null);
              return { code: v.code, title: v.title, quantities, complete: quantities.every((q) => q !== null) };
            }),
          },
        };
      })
    );
  }

  /** خروجی ماتریس مشتق به CSV با BOM (نیمه‌ی خروجی F-PE-056). */
  exportMatrix(code: string, m: DerivedMatrix): void {
    const header = ['کد ترکیب', 'ترکیب', ...m.items.map((i) => `${i.label} (${i.unit})`)];
    const rows = m.variants.map((v) => [v.code, v.title, ...v.quantities.map((q) => (q === null ? '' : q))]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `${code}-matrix.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
