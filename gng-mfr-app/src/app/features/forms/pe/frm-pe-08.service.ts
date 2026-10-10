import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { ExplodeNode, Option, WhereUsedRow } from './frm-pe-08.data';

interface ExplodeApiRow {
  Level: number;
  NodeKey: string;
  ParentKey: string;
  ProductId: number;
  ProductCode: string;
  ProductTitle: string;
  UnitTitle: string;
  QuantityTypeCode: number;
  Required: number | null;
  IsPhantom: boolean;
  ChildStructureCode: string | null;
  IsCycle: boolean;
  IsLeaf: boolean;
}
interface WhereUsedApiRow {
  Level: number;
  SearchedCode: string;
  SearchedTitle: string;
  StructureCode: string;
  StructureTitle: string;
  TypeCode: number;
  IsDefault: boolean;
  MainProductCode: string | null;
  MainProductTitle: string | null;
  Revisions: string | null;
  InCurrent: boolean;
  ViaTemplate: boolean;
}
interface CycleApiRow {
  CycleText: string | null;
  EdgeCount: number;
}

const TYPE: Record<number, string> = { 1: 'تولیدی', 2: 'آزمایشی', 3: 'الگو', 4: 'نمونه‌سازی', 5: 'مهندسی' };

/**
 * کنسول تحلیلی FRM-PE-08 روی رویه‌های mes.ExplodeStructure، mes.GetWhereUsed و
 * mes.FindStructureCycles (scripts/mes_frm_pe08_setup.sql). فهرست ساختارها و کالاها
 * از اندپوینت‌های FRM-PE-02 و FRM-PE-01 خوانده می‌شود.
 */
@Injectable({ providedIn: 'root' })
export class FrmPe08Service {
  constructor(private http: HttpClient) {}

  structures(companyId = DEMO_COMPANY_ID): Observable<(Option & { base: number | null; unit: string })[]> {
    return this.http
      .get<{ StructureId: number; Code: string; Title: string; TypeCode: number; IsDefault: boolean; BaseQuantity: number | null; ProductUnit: string | null }[]>(
        `${API_BASE_URL}/api/pe02/structures`,
        { params: { companyId } }
      )
      .pipe(
        map((rows) =>
          rows
            .filter((r) => r.TypeCode !== 3)
            .map((r) => ({ label: `${r.Code} — ${r.Title}${r.IsDefault ? ' ★' : ''}`, value: r.StructureId, base: r.BaseQuantity, unit: r.ProductUnit ?? '' }))
        )
      );
  }

  products(companyId = DEMO_COMPANY_ID): Observable<Option[]> {
    return this.http
      .get<{ items: { ProductId: number; Code: string; Title: string }[] }>(`${API_BASE_URL}/api/pe01/bundle`, { params: { companyId } })
      .pipe(map((b) => b.items.map((i) => ({ label: `${i.Code} — ${i.Title}`, value: i.ProductId }))));
  }

  explode(structureId: number, quantity: number | null, applyWaste: boolean): Observable<ExplodeNode[]> {
    const params: Record<string, string | number> = { structureId, applyWaste: applyWaste ? 1 : 0 };
    if (quantity) params['quantity'] = quantity;
    return this.http.get<ExplodeApiRow[]>(`${API_BASE_URL}/api/pe08/explode`, { params }).pipe(
      map((rows) =>
        rows.map((r) => ({
          key: r.NodeKey,
          parentKey: r.ParentKey,
          level: r.Level,
          productId: r.ProductId,
          product: `${r.ProductCode} — ${r.ProductTitle}`,
          unit: r.UnitTitle,
          required: r.Required,
          formula: r.QuantityTypeCode === 3,
          isPhantom: r.IsPhantom,
          isLeaf: r.IsLeaf,
          isCycle: r.IsCycle,
          childStructure: r.ChildStructureCode ?? '',
        }))
      )
    );
  }

  whereUsed(productId: number, multi: boolean): Observable<WhereUsedRow[]> {
    return this.http.get<WhereUsedApiRow[]>(`${API_BASE_URL}/api/pe08/where-used`, { params: { productId, multi: multi ? 1 : 0 } }).pipe(
      map((rows) =>
        rows.map((r) => ({
          level: r.Level,
          searched: `${r.SearchedCode} — ${r.SearchedTitle}`,
          structure: `${r.StructureCode} — ${r.StructureTitle}`,
          type: TYPE[r.TypeCode] ?? '—',
          isDefault: r.IsDefault,
          mainProduct: r.MainProductCode ? `${r.MainProductCode} — ${r.MainProductTitle}` : '—',
          revisions: r.Revisions ?? 'از الگو',
          inCurrent: r.InCurrent,
          viaTemplate: r.ViaTemplate,
        }))
      )
    );
  }

  cycles(): Observable<{ cycles: string[]; edges: number }> {
    return this.http.get<CycleApiRow[]>(`${API_BASE_URL}/api/pe08/cycles`).pipe(
      map((rows) => ({ cycles: rows.filter((r) => r.CycleText).map((r) => r.CycleText!), edges: rows[0]?.EdgeCount ?? 0 }))
    );
  }
}
