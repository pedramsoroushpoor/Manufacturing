import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { EntityType, Pe10Bundle, faDigits } from './frm-pe-10.data';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const n = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const nn = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));
const b = (v: unknown): boolean => v === true || v === 1;
/** زمان ISO ← میلی‌ثانیه (زمان محلی سناریو با برچسب Z) */
const ts = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const t = Date.parse(String(v));
  return Number.isNaN(t) ? null : t;
};

/** یک ردیف بسط سرور (mes.ExplodeStructure) برای کنترل متقابل پرتونگاری */
export interface ServerExplodeRow { productId: number; required: number | null; isLeaf: boolean; isCycle: boolean; level: number }

/**
 * FRM-PE-10 روی mes.GetBiPe* (یک فراخوانی؛ فقط‌خواندنی) و برای کنترل متقابل بسط، endpoint موجود /api/pe08/explode.
 */
@Injectable({ providedIn: 'root' })
export class FrmPe10Service {
  constructor(private http: HttpClient) {}

  bundle(companyId = DEMO_COMPANY_ID): Observable<Pe10Bundle> {
    return this.http.get<Record<string, any>>(`${API_BASE_URL}/api/pe10/bundle`, { params: { companyId } }).pipe(
      map((x) => {
        const rows = (k: string): Row[] => (Array.isArray(x[k]) ? (x[k] as Row[]) : []);
        return {
          products: rows('products').map((r) => ({
            id: n(r['ProductId']), code: s(r['ProductCode']), title: s(r['ProductTitle']), unit: s(r['UnitTitle']), group: s(r['ProductGroupTitle']) || 'بدون گروه',
            itemId: nn(r['ProductionItemId']), role: nn(r['ProductionRoleCode']), tracking: nn(r['TrackingLevelCode']), phantom: b(r['IsPhantom']),
            dimensional: b(r['IsDimensional']), policies: n(r['Policies']), make: n(r['MakeCount']), buy: n(r['BuyCount']), outsource: n(r['OutsourceCount']),
            badContractors: s(r['BadContractors']), lotSizes: n(r['LotSizeCount']), defaultStructureId: nn(r['DefaultStructureId']), structureCount: n(r['StructureCount']),
            onHand: n(r['ReleasedOnHand']), reserved: n(r['ReleasedReserved']), quarantine: n(r['QuarantineQty']), rejected: n(r['RejectedQty']),
            expired: n(r['ExpiredQty']), inTransit: n(r['InTransitQty']), customerOwned: n(r['CustomerOwnedQty']), nextArrival: ts(r['NextArrival']),
            nearestExpiry: ts(r['NearestExpiry']), batches: n(r['Batches']), consumed14: n(r['Consumed14']), openReq: n(r['OpenRequirement']),
            openOrders: n(r['OpenOrders']), earliestDue: ts(r['EarliestDue']), hasRecovered: b(r['HasRecoveredMaterial']), subGroups: n(r['SubstituteGroups']),
          })),
          structures: rows('structures').map((r) => ({
            id: n(r['StructureId']), code: s(r['StructureCode']), title: s(r['StructureTitle']), type: n(r['TypeCode']), status: n(r['StatusCode']),
            isDefault: b(r['IsDefault']), productId: nn(r['ProductId']), baseQty: nn(r['BaseQuantity']), license: s(r['License']), templateId: nn(r['TemplateId']),
            allowOver100: b(r['AllowPercentOver100']), revisionCode: s(r['RevisionCode']), revisionStatus: nn(r['RevisionStatusCode']),
            effectivity: nn(r['EffectivityTypeCode']), ecoNumber: s(r['EcoNumber']), revisionFrom: ts(r['RevisionFrom']), approver: s(r['ApproverTitle']),
            revisionCount: n(r['RevisionCount']), licenseValidTo: ts(r['LicenseValidTo']), licenseCount: n(r['LicenseCount']), itemCount: n(r['ItemCount']),
            pctRows: n(r['PctRows']), pctSum: n(r['PctSum']), qsRows: n(r['QsRows']), yieldRows: n(r['YieldRows']), yieldTotal: nn(r['YieldTotal']),
            outputCount: n(r['OutputCount']), costShareTotal: nn(r['CostShareTotal']), matrixCells: n(r['MatrixCells']), matrixMissing: n(r['MatrixMissing']),
            openOrders: n(r['OpenOrders']), totalOrders: n(r['TotalOrders']), lastCompleted: ts(r['LastCompleted']),
          })),
          items: rows('items').map((r) => ({
            structureId: n(r['StructureId']), itemId: n(r['ItemId']), source: s(r['Source']), productId: n(r['ProductId']), seq: n(r['Sequence']),
            qtyType: n(r['QuantityTypeCode']), qty: n(r['Quantity']), qtyAtBase: nn(r['QtyAtBase']), wastePct: nn(r['WastePercent']), wasteQty: nn(r['WasteQuantity']),
            qs: b(r['IsQuantumSatis']), ai: b(r['IsActiveIngredient']), main: b(r['IsMainMaterial']), roleTitle: s(r['ItemRoleTitle']),
            minC: nn(r['MinConsumptionPercent']), maxC: nn(r['MaxConsumptionPercent']), subGroupId: nn(r['SubstituteGroupId']), recovery: b(r['IsRecovery']),
            maxRecovered: nn(r['MaxRecoveredUsePercent']), dimensionId: nn(r['ProductionDimensionId']), childStructureId: nn(r['ChildStructureId']),
          })),
          checks: rows('checks').map((r) => ({
            entityType: s(r['EntityType']) as EntityType, entityId: n(r['EntityId']), entityCode: s(r['EntityCode']), entityTitle: s(r['EntityTitle']),
            structureId: nn(r['StructureId']), productId: nn(r['ProductId']), code: s(r['CheckCode']), passed: b(r['Passed']), severity: n(r['Severity']),
            form: s(r['FormCode']), detail: faDigits(s(r['Detail'])),
          })),
          consumption: rows('consumption').map((r) => ({
            woId: n(r['WorkOrderId']), wo: s(r['WorkOrderNumber']), woStatus: n(r['WorkOrderStatusCode']), woType: n(r['WOTypeCode']), structureId: nn(r['StructureId']),
            itemId: n(r['ItemId']), productId: n(r['ProductId']), opSeq: n(r['OperationSequence']), std: n(r['StandardQuantity']), produced: n(r['ProducedAtOperation']),
            stdForProduced: n(r['StandardForProduced']), actual: nn(r['Actual']), entries: n(r['Entries']), potency: nn(r['AvgPotency']), lastAt: ts(r['LastAt']),
            substitutedId: nn(r['SubstitutedProductId']), recovered: b(r['IsRecoveredMaterial']), ai: b(r['IsActiveIngredient']),
          })),
          yields: rows('yields').map((r) => ({
            woId: n(r['WorkOrderId']), wo: s(r['WorkOrderNumber']), structureId: nn(r['StructureId']), productId: n(r['ProductId']), type: n(r['TypeCode']),
            stdYield: n(r['StandardYield']), min: nn(r['MinYieldPercent']), max: nn(r['MaxYieldPercent']), orderQty: n(r['OrderQuantity']), ratio: nn(r['MainMaterialRatio']),
            produced: n(r['Produced']), received: n(r['Received']), actualYield: nn(r['ActualYield']),
          })),
          orders: rows('orders').map((r) => ({
            woId: n(r['WorkOrderId']), wo: s(r['WorkOrderNumber']), woStatus: n(r['WorkOrderStatusCode']), woType: n(r['WOTypeCode']), due: ts(r['DueDate']),
            mainProductId: n(r['MainProductId']), structureId: nn(r['StructureId']), opSeq: n(r['OperationSequence']), productId: n(r['ProductId']),
            itemId: nn(r['ItemId']), subGroupId: nn(r['SubstituteGroupId']), substitutedId: nn(r['SubstitutedProductId']), customer: b(r['IsCustomerMaterial']),
            std: n(r['StandardQuantity']), consumed: n(r['Consumed']), remaining: n(r['Remaining']),
          })),
          requests: rows('requests').map((r) => ({
            id: n(r['RequestId']), number: s(r['Number']), status: n(r['StatusCode']), priority: n(r['PriorityCode']), productId: n(r['ProductId']),
            qty: n(r['Quantity']), need: ts(r['NeedDate']), customer: s(r['CustomerTitle']), linked: n(r['LinkedOrders']),
          })),
          ecos: rows('ecos').map((r) => ({
            id: n(r['EcoId']), number: s(r['Number']), title: s(r['Title']), origin: n(r['OriginCode']), priority: n(r['PriorityCode']), status: n(r['StatusCode']),
            requestedBy: s(r['RequestedByTitle']), requestDate: ts(r['RequestDate']), effectiveDate: ts(r['EffectiveDate']), policy: nn(r['InventoryPolicyCode']),
            policyCondition: s(r['InventoryPolicyCondition']), reason: s(r['Reason']), itemCount: n(r['ItemCount']), approverCount: n(r['ApproverCount']),
            signedCount: n(r['SignedCount']), linkedRevisions: s(r['LinkedRevisions']),
          })),
          ecoItems: rows('ecoItems').map((r) => ({
            ecoId: n(r['EcoId']), id: n(r['EcoItemId']), entityType: n(r['EntityTypeCode']), changeType: n(r['ChangeTypeCode']), structureId: nn(r['StructureId']),
            productId: nn(r['ProductId']), groupId: nn(r['SubstituteGroupId']), before: s(r['BeforeText']), after: s(r['AfterText']), description: s(r['Description']),
          })),
          ecoApprovals: rows('ecoApprovals').map((r) => ({
            ecoId: n(r['EcoId']), seq: n(r['Sequence']), role: s(r['RoleTitle']), approver: s(r['ApproverTitle']), decision: nn(r['DecisionCode']), signedOn: ts(r['SignedOn']),
          })),
          substitutes: rows('substitutes').map((r) => ({
            groupId: n(r['GroupId']), groupCode: s(r['GroupCode']), groupTitle: s(r['GroupTitle']), combinable: b(r['IsCombinable']), active: b(r['IsActive']),
            optionNo: n(r['OptionNo']), optionTitle: s(r['OptionTitle']), priority: nn(r['Priority']), productId: n(r['ProductId']), ratio: n(r['Ratio']) || 1,
          })),
          outputs: rows('outputs').map((r) => ({
            structureId: n(r['StructureId']), productId: n(r['ProductId']), type: n(r['TypeCode']), qty: n(r['Quantity']), yieldPct: nn(r['YieldPercent']),
            min: nn(r['MinYieldPercent']), max: nn(r['MaxYieldPercent']),
          })),
          recovery: rows('recoveryReceipts').map((r) => ({
            receipt: s(r['ReceiptNumber']), wo: s(r['WorkOrderNumber']), material: s(r['RecoveredTitle']), source: s(r['SourceTitle']), input: n(r['SourceInput']),
            recovered: n(r['Recovered']), actualPct: nn(r['ActualPercent']), stdPct: nn(r['StandardPercent']), stdSource: s(r['StandardSource']),
            threshold: n(r['ThresholdPoints']) || 5, batch: s(r['NewBatchNumber']), cycle: nn(r['RecoveryCycle']), purity: nn(r['PurityPercent']),
            minPurity: nn(r['MinPurityPercent']), at: ts(r['ReceiptDate']),
          })),
        };
      })
    );
  }

  /** بسط سرور برای کنترل متقابل (endpoint موجود FRM-PE-08) */
  explode(structureId: number, quantity: number): Observable<ServerExplodeRow[]> {
    return this.http
      .get<Row[]>(`${API_BASE_URL}/api/pe08/explode`, { params: { structureId, quantity, applyWaste: 1 } })
      .pipe(map((rs) => (Array.isArray(rs) ? rs : []).map((r) => ({ productId: n(r['ProductId']), required: nn(r['Required']), isLeaf: b(r['IsLeaf']), isCycle: b(r['IsCycle']), level: n(r['Level']) }))));
  }
}
