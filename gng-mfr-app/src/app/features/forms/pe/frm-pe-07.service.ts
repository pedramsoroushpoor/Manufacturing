import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { Pe07Bundle, ResolvedRow, Violation } from './frm-pe-07.data';

interface ApiBundle {
  models: { ModelId: number; Code: string; Title: string; ProductTitle: string; StructureTitle: string; IsActive: boolean; Description: string | null; FeatureCount: number }[];
  values: { ModelId: number; FeatureId: number; Sequence: number; FeatureCode: string; FeatureTitle: string; IsMandatory: boolean; ValueId: number; ValueCode: string; ValueTitle: string; IsDefault: boolean; ConditionCount: number }[];
  rules: { ModelId: number; RuleTypeCode: number; IfValueId: number; IfTitle: string; ThenValueId: number; ThenTitle: string; Message: string | null }[];
  conditions: { ModelId: number; ActionCode: number; ValueId: number; ValueTitle: string; ItemSequence: number | null; ProductTitle: string | null; Quantity: number | null; UnitTitle: string | null; HasProductionRole: boolean; Description: string | null }[];
}

const ACTION: Record<number, string> = { 1: 'ردیف فقط اگر', 2: 'حذف ردیف اگر', 3: 'افزودن قلم اگر' };

/** FRM-PE-07 روی mes.GetConfiguration* و mes.ResolveConfiguredStructure (scripts/mes_frm_pe07_setup.sql). */
@Injectable({ providedIn: 'root' })
export class FrmPe07Service {
  constructor(private http: HttpClient) {}

  load(companyId = DEMO_COMPANY_ID): Observable<Pe07Bundle> {
    return this.http.get<ApiBundle>(`${API_BASE_URL}/api/pe07/bundle`, { params: { companyId } }).pipe(
      map((b) => ({
        models: b.models.map((m) => ({ id: m.ModelId, code: m.Code, title: m.Title, product: m.ProductTitle, structure: m.StructureTitle, active: m.IsActive, description: m.Description ?? '', featureCount: m.FeatureCount })),
        values: b.values.map((v) => ({
          modelId: v.ModelId,
          featureId: v.FeatureId,
          sequence: v.Sequence,
          featureCode: v.FeatureCode,
          feature: v.FeatureTitle,
          mandatory: v.IsMandatory,
          valueId: v.ValueId,
          valueCode: v.ValueCode,
          value: v.ValueTitle,
          isDefault: v.IsDefault,
          conditionCount: v.ConditionCount,
        })),
        rules: b.rules.map((r) => ({ modelId: r.ModelId, typeCode: r.RuleTypeCode, ifValueId: r.IfValueId, ifTitle: r.IfTitle, thenValueId: r.ThenValueId, thenTitle: r.ThenTitle, message: r.Message ?? '' })),
        conditions: b.conditions.map((c) => ({
          modelId: c.ModelId,
          actionCode: c.ActionCode,
          action: ACTION[c.ActionCode] ?? '—',
          valueId: c.ValueId,
          valueTitle: c.ValueTitle,
          itemSequence: c.ItemSequence,
          product: c.ProductTitle ?? '—',
          quantity: c.Quantity,
          unit: c.UnitTitle ?? '',
          hasProductionRole: c.HasProductionRole,
          description: c.Description ?? '',
        })),
      }))
    );
  }

  resolve(modelId: number, valueIds: number[]): Observable<{ violations: Violation[]; items: ResolvedRow[] }> {
    return this.http
      .get<{ violations: { Kind: 'rule' | 'missing'; Text: string; Message: string | null }[]; items: { Sequence: number | null; ProductTitle: string; Quantity: number | null; UnitTitle: string | null; Status: ResolvedRow['status']; ConditionText: string | null }[] }>(
        `${API_BASE_URL}/api/pe07/resolve`,
        { params: { modelId, values: valueIds.join(',') } }
      )
      .pipe(
        map((r) => ({
          violations: r.violations.map((v) => ({ kind: v.Kind, text: v.Text, message: v.Message ?? '' })),
          items: r.items.map((i) => ({ sequence: i.Sequence, product: i.ProductTitle, quantity: i.Quantity, unit: i.UnitTitle ?? '', status: i.Status, condition: i.ConditionText ?? '' })),
        }))
      );
  }
}
