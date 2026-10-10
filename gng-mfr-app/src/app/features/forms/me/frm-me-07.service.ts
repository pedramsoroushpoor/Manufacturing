import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { faDay } from './me-routing';
import { Me07Bundle } from './frm-me-07.data';

interface ApiBundle {
  operations: { RoutingOperationId: number; RoutingTitle: string; RoutingStatusCode: number | null; Sequence: number; OperationTitle: string; OpsBefore: number; OpsAfter: number; ContractorCount: number }[];
  subcontracts: {
    RoutingOperationId: number; ContractorTitle: string; ContractorIsActive: boolean; QualificationStatusCode: number | null; ContractToDate: string | null; CapabilityOperation: string | null;
    Priority: number; SelectionRuleCode: number; FeePerUnit: number | null; FeeUnitTitle: string | null; CurrencyTitle: string | null; LeadTimeDays: number | null;
    AllowedWastePercent: number | null; MaterialSupplyCode: number; ServiceItemTitle: string | null; Description: string | null; HasCapability: boolean; RegisteredFee: number | null;
  }[];
  items: { RoutingOperationId: number; DirectionCode: number; ProductTitle: string; UnitTitle: string | null; Quantity: number | null; SupplyModeCode: number; Description: string | null }[];
  toll: {
    RoutingId: number; RoutingTitle: string; CustomerTitle: string | null; ProductTitle: string; ProductGroupTitle: string | null; Quantity: number | null; UnitTitle: string | null;
    OwnershipCode: number | null; SurplusSettlementCode: number | null; WasteSettlementCode: number | null; Description: string | null;
  }[];
}

const RULE: Record<number, string> = { 1: 'اصلی', 2: 'ظرفیت / در دسترس بودن', 3: 'کمترین هزینه', 4: 'کمترین زمان تحویل' };
const SUPPLY: Record<number, string> = { 1: 'ما تأمین می‌کنیم', 2: 'پیمانکار تأمین می‌کند', 3: 'ترکیبی (قلم به قلم)' };
const QUALIFICATION: Record<number, string> = { 1: 'تأییدشده', 2: 'مشروط', 3: 'تعلیق' };
export const SETTLEMENT: Record<number, string> = { 1: 'بازگشت به مشتری', 2: 'فروش به مشتری', 3: 'اسقاط با صورت‌جلسه' };

/** FRM-ME-07 روی mes.GetOutsourcedOperations، GetRoutingSubcontracts، GetRoutingSubcontractItems، GetRoutingTollMaterials. */
@Injectable({ providedIn: 'root' })
export class FrmMe07Service {
  constructor(private http: HttpClient) {}

  load(companyId = DEMO_COMPANY_ID): Observable<Me07Bundle> {
    return this.http.get<ApiBundle>(`${API_BASE_URL}/api/me07/bundle`, { params: { companyId } }).pipe(
      map((b) => ({
        operations: b.operations.map((o) => ({
          id: o.RoutingOperationId,
          routing: o.RoutingTitle,
          routingStatusCode: o.RoutingStatusCode ?? 1,
          sequence: o.Sequence,
          operation: o.OperationTitle,
          opsBefore: o.OpsBefore,
          opsAfter: o.OpsAfter,
          contractorCount: o.ContractorCount,
        })),
        subcontracts: b.subcontracts.map((s) => ({
          routingOperationId: s.RoutingOperationId,
          contractor: s.ContractorTitle,
          contractorActive: s.ContractorIsActive,
          qualificationCode: s.QualificationStatusCode ?? 0,
          qualification: QUALIFICATION[s.QualificationStatusCode ?? 0] ?? '—',
          contractTo: faDay(s.ContractToDate),
          capabilityOperation: s.CapabilityOperation ?? '—',
          priority: s.Priority,
          rule: RULE[s.SelectionRuleCode] ?? '—',
          fee: s.FeePerUnit,
          feeUnit: s.FeeUnitTitle ?? '',
          currency: s.CurrencyTitle ?? '',
          leadDays: s.LeadTimeDays,
          allowedWaste: s.AllowedWastePercent,
          supplyCode: s.MaterialSupplyCode,
          supply: SUPPLY[s.MaterialSupplyCode] ?? '—',
          serviceItem: s.ServiceItemTitle ?? '',
          description: s.Description ?? '',
          hasCapability: s.HasCapability,
          registeredFee: s.RegisteredFee,
        })),
        items: b.items.map((i) => ({
          routingOperationId: i.RoutingOperationId,
          directionCode: i.DirectionCode,
          product: i.ProductTitle,
          unit: i.UnitTitle ?? '',
          quantity: i.Quantity,
          supplyCode: i.SupplyModeCode,
          description: i.Description ?? '',
        })),
        toll: b.toll.map((t) => ({
          routingId: t.RoutingId,
          routing: t.RoutingTitle,
          customer: t.CustomerTitle ?? '',
          product: t.ProductTitle,
          group: t.ProductGroupTitle ?? '',
          quantity: t.Quantity,
          unit: t.UnitTitle ?? '',
          ownershipCode: t.OwnershipCode,
          surplusCode: t.SurplusSettlementCode,
          wasteCode: t.WasteSettlementCode,
          description: t.Description ?? '',
        })),
      }))
    );
  }
}
