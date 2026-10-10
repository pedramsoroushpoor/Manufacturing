import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { Me06Bundle } from './frm-me-06.data';

interface ApiPolicy {
  PolicyId: number; Number: string | null; Name: string; ScopeTypeCode: number; ProductGroupTitle: string | null; ProductId: number | null; ProductTitle: string | null;
  RoutingOperationId: number | null; OperationTitle: string | null; VersionTitle: string | null; FeedingPolicyCode: number | null; ConsumptionPolicyCode: number | null; BackflushBasisCode: number | null;
  BackflushMomentCode: number | null; ShortageBehaviorCode: number | null; BackflushSourceInventoryTitle: string | null; IsBackflushExcluded: boolean | null;
  ExclusionReasonCode: number | null; ReceiptPolicyCode: number | null; ConsumptionInventoryTitle: string | null; ReceiptInventoryTitle: string | null;
  DocumentPatternTitle: string | null; AllocationPolicyCode: number | null; TransferBasisCode: number | null; PackageSize: number | null; LineSideTitle: string | null;
  LineSideCapacity: number | null; MinStock: number | null; MaxStock: number | null; ReorderPoint: number | null; ConsumptionControlCode: number | null; Description: string | null;
}
interface ApiBundle {
  policies: ApiPolicy[];
  items: {
    ProductId: number; ProductCode: string; ProductTitle: string; ProductGroupTitle: string | null; UnitTitle: string | null; TrackingLevelCode: number | null;
    IsActiveIngredient: boolean; MinConsumptionPercent: number | null; MaxConsumptionPercent: number | null; RoutingOperationId: number; OperationTitle: string; IsBackflushed: boolean;
  }[];
}

export const SCOPE: Record<number, string> = { 1: 'شرکت', 2: 'گروه کالا', 3: 'کالا', 4: 'عملیات روش', 5: 'نسخه‌ی تولید' };
export const CODES = {
  feeding: { 1: 'انتقال به انبار پای کار', 2: 'تحویل مستقیم به خط', 3: 'کششی (کانبان)', 4: 'تأمین پیوسته', 5: 'تأمین از پیمانکار' } as Record<number, string>,
  consumption: { 1: 'ثبت دستی', 2: 'Backflush پایان عملیات', 3: 'Backflush در رسید محصول', 4: 'ترکیبی' } as Record<number, string>,
  backflushBasis: { 1: 'مقدار تأییدشده', 2: 'کل تولید' } as Record<number, string>,
  backflushMoment: { 1: 'پایان عملیات', 2: 'رسید محصول', 3: 'بستن دستور' } as Record<number, string>,
  shortage: { 1: 'توقف', 2: 'موجودی منفی مجاز', 3: 'هشدار و ثبت کسری' } as Record<number, string>,
  exclusionReason: { 1: 'قلم گران', 2: 'عیاردار', 3: 'ردیابی سریالی' } as Record<number, string>,
  receipt: { 1: 'رسید مستقیم', 2: 'مجوز ورود', 3: 'مشروط به تأیید کیفی', 4: 'انبار قرنطینه' } as Record<number, string>,
  allocation: { 1: 'FEFO', 2: 'FIFO', 3: 'بچ مشخص', 4: 'بر مبنای عیار' } as Record<number, string>,
  transferBasis: { 1: 'کل مقدار سفارش', 2: 'اندازه‌ی بچ عملیات', 3: 'اندازه‌ی بسته' } as Record<number, string>,
  consumptionControl: { 1: 'بدون کنترل', 2: 'هشدار', 3: 'منع' } as Record<number, string>,
};

/** FRM-ME-06 روی mes.GetMaterialPolicies و mes.GetPolicyItems. */
@Injectable({ providedIn: 'root' })
export class FrmMe06Service {
  constructor(private http: HttpClient) {}

  load(companyId = DEMO_COMPANY_ID): Observable<Me06Bundle> {
    return this.http.get<ApiBundle>(`${API_BASE_URL}/api/me06/bundle`, { params: { companyId } }).pipe(
      map((b) => ({
        policies: b.policies.map((p) => ({
          id: p.PolicyId,
          code: p.Number ?? '',
          name: p.Name,
          scopeCode: p.ScopeTypeCode,
          scope: SCOPE[p.ScopeTypeCode] ?? '—',
          group: p.ProductGroupTitle ?? '',
          productId: p.ProductId,
          product: p.ProductTitle ?? '',
          routingOperationId: p.RoutingOperationId,
          operation: p.OperationTitle ?? '',
          version: p.VersionTitle ?? '',
          description: p.Description ?? '',
          values: {
            feeding: p.FeedingPolicyCode,
            consumption: p.ConsumptionPolicyCode,
            backflushBasis: p.BackflushBasisCode,
            backflushMoment: p.BackflushMomentCode,
            shortage: p.ShortageBehaviorCode,
            backflushSource: p.BackflushSourceInventoryTitle,
            excluded: p.IsBackflushExcluded,
            exclusionReason: p.ExclusionReasonCode,
            receipt: p.ReceiptPolicyCode,
            consumptionInventory: p.ConsumptionInventoryTitle,
            receiptInventory: p.ReceiptInventoryTitle,
            documentPattern: p.DocumentPatternTitle,
            allocation: p.AllocationPolicyCode,
            transferBasis: p.TransferBasisCode,
            packageSize: p.PackageSize,
            lineSide: p.LineSideTitle,
            lineSideCapacity: p.LineSideCapacity,
            minStock: p.MinStock,
            maxStock: p.MaxStock,
            reorderPoint: p.ReorderPoint,
            consumptionControl: p.ConsumptionControlCode,
          },
        })),
        items: b.items.map((i) => ({
          productId: i.ProductId,
          product: `${i.ProductCode} — ${i.ProductTitle}`,
          group: i.ProductGroupTitle ?? '',
          unit: i.UnitTitle ?? '',
          trackingCode: i.TrackingLevelCode,
          isActiveIngredient: i.IsActiveIngredient,
          minConsumption: i.MinConsumptionPercent,
          maxConsumption: i.MaxConsumptionPercent,
          routingOperationId: i.RoutingOperationId,
          operation: i.OperationTitle,
          backflushedInRouting: i.IsBackflushed,
        })),
      }))
    );
  }
}
