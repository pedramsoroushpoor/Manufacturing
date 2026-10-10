import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { ConsumptionRow, Pc10Bundle, ProgressRow, ReconRow, Shipment, ShipmentItem, StatementRow, StockRow, SubOrder, TollContract } from './frm-pc-10.data';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const n = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const nn = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export const mapSubOrder = (r: Row): SubOrder => ({
  workOrderId: r['WorkOrderId'], workOrder: s(r['WorkOrderNumber']), batch: s(r['BatchNumber']), product: s(r['ProductTitle']),
  operationId: r['OperationId'], opSeq: n(r['OperationSequence']), opTitle: s(r['OperationTitle']), opStatusCode: n(r['OperationStatusCode']),
  toComplete: n(r['ToCompleteQuantity']), contractorId: r['ContractorId'], contractorCode: s(r['ContractorCode']), contractor: s(r['ContractorTitle']),
  sendNumber: s(r['SendNumber']), sentAt: r['SentAt'], dueDate: r['ExpectedReturnDate'], serviceRequest: s(r['ServiceRequestNumber']),
  transferDoc: s(r['TransferDocumentNumber']), waybill: s(r['WaybillNumber']), feePerUnit: nn(r['FeePerUnit']), feeUnitTitle: s(r['FeeUnitTitle']),
  leadDays: nn(r['LeadTimeDays']), rateTitle: s(r['RateTitle']), stageCode: nn(r['StageCode']), progressAt: r['ProgressAt'],
  progressCompleted: n(r['ProgressCompleted']), progressWasted: n(r['ProgressWasted']), expectedReady: r['ExpectedReadyDate'],
  receivedGood: n(r['ReceivedGood']), accepted: n(r['Accepted']), receivedDefective: n(r['ReceivedDefective']), declaredWaste: n(r['DeclaredWaste']),
  lastReceipt: r['LastReceipt'], feePayable: nn(r['FeePayable']), delayDays: n(r['DelayDays']), isOverdue: !!r['IsOverdue'],
  nextSeq: nn(r['NextSequence']), nextOpTitle: s(r['NextOperationTitle']), nextStatusCode: nn(r['NextStatusCode']), nextReceived: n(r['NextReceived']),
});

export const mapProgress = (r: Row): ProgressRow => ({
  id: r['ProgressId'], workOrderId: r['WorkOrderId'], workOrder: s(r['WorkOrderNumber']), opSeq: n(r['OperationSequence']), contractor: s(r['ContractorTitle']),
  reportedAt: r['ReportedAt'], stageCode: n(r['StageCode']), completed: n(r['CompletedQuantity']), wasted: n(r['WastedQuantity']),
  expectedReady: r['ExpectedReadyDate'], reportedBy: s(r['ReportedByTitle']), sourceCode: n(r['SourceCode']), note: s(r['Note']),
});

export const mapItem = (r: Row): ShipmentItem => ({
  id: r['ItemId'], shipmentId: r['ShipmentId'], productId: r['ProductId'], product: s(r['ProductTitle']), unit: s(r['UnitTitle']), batch: s(r['BatchNumber']),
  quantity: n(r['Quantity']), roleCode: n(r['ItemRoleCode']), accepted: nn(r['AcceptedQuantity']), rejected: nn(r['RejectedQuantity']),
  customerOwned: !!r['IsCustomerOwned'], owner: s(r['OwnerTitle']), description: s(r['Description']),
});

export const mapShipments = (rows: Row[], items: ShipmentItem[]): Shipment[] =>
  rows
    .map((r) => ({
      id: r['ShipmentId'], number: s(r['Number']), directionCode: n(r['DirectionCode']), contractorId: nn(r['ContractorId']), contractor: s(r['ContractorTitle']),
      tollingContractId: nn(r['TollingContractId']), customer: s(r['CustomerTitle']), workOrderId: nn(r['WorkOrderId']), workOrder: s(r['WorkOrderNumber']),
      opSeq: nn(r['OperationSequence']), date: r['ShipmentDate'], expectedReturn: r['ExpectedReturnDate'], transferDoc: s(r['TransferDocumentNumber']),
      waybill: s(r['WaybillNumber']), vehicle: s(r['VehicleTitle']), driver: s(r['DriverTitle']), serviceRequest: s(r['ServiceRequestNumber']),
      statusCode: n(r['StatusCode']), contractorInventory: s(r['ContractorInventoryTitle']), referenceInventory: s(r['ReferenceInventoryNumber']),
      description: s(r['Description']), items: items.filter((i) => i.shipmentId === r['ShipmentId']),
    }))
    .sort((a, b) => s(a.date).localeCompare(s(b.date)));

export const mapRecon = (r: Row): ReconRow => ({
  workOrderId: r['WorkOrderId'], workOrder: s(r['WorkOrderNumber']), contractor: s(r['ContractorTitle']), productId: r['ProductId'], product: s(r['ProductTitle']),
  unit: s(r['UnitTitle']), batch: s(r['BatchNumber']), sent: n(r['Sent']), declared: n(r['DeclaredConsumption']), returned: n(r['ReturnedUnused']),
  remaining: n(r['RemainingAtContractor']), difference: n(r['Difference']),
});

export const mapContract = (r: Row): TollContract => ({
  id: r['TollingContractId'], number: s(r['ContractNumber']), customer: s(r['CustomerTitle']), product: s(r['ProductTitle']), feePerUnit: nn(r['FeePerUnit']),
  feeUnitTitle: s(r['FeeUnitTitle']), feeUnitSize: n(r['FeeUnitSize']) || 1, allowedWastePct: n(r['AllowedWastePercent']), validFrom: r['ValidFromDate'],
  validTo: r['ValidToDate'], workOrderId: nn(r['WorkOrderId']), workOrder: s(r['WorkOrderNumber']), woStatusCode: n(r['WorkOrderStatusCode']),
  orderQty: n(r['OrderQuantity']), batch: s(r['BatchNumber']), delivered: n(r['Delivered']), feeEarned: nn(r['FeeEarned']), feeProjected: nn(r['FeeProjected']),
  furthestCompleted: n(r['FurthestCompleted']), wastedSoFar: n(r['WastedSoFar']), description: s(r['Description']),
});

export const mapStatement = (r: Row): StatementRow => ({
  contractId: r['TollingContractId'], customer: s(r['CustomerTitle']), productId: r['ProductId'], product: s(r['ProductTitle']), unit: s(r['UnitTitle']),
  batch: s(r['BatchNumber']), received: n(r['Received']), firstReceipt: r['FirstReceipt'], consumed: n(r['Consumed']), remaining: n(r['Remaining']),
  difference: n(r['Difference']),
});

const mapStock = (r: Row): StockRow => ({
  owner: s(r['OwnerTitle']), customerOwned: !!r['IsCustomerOwned'], kindCode: n(r['InventoryKindCode']), inventory: s(r['InventoryTitle']),
  productId: r['ProductId'], product: s(r['ProductTitle']), group: s(r['ProductGroupTitle']), unit: s(r['UnitTitle']), batch: s(r['BatchNumber']),
  onHand: n(r['OnHandQuantity']), qcCode: n(r['QcStatusCode']), holder: s(r['HolderTitle']),
});

const mapConsumption = (r: Row): ConsumptionRow => ({
  workOrder: s(r['WorkOrderNumber']), woTypeCode: n(r['WOTypeCode']), customer: s(r['CustomerTitle']), customerMaterial: !!r['IsCustomerMaterial'],
  product: s(r['ProductTitle']), unit: s(r['UnitTitle']), consumed: n(r['Consumed']),
});

/** FRM-PC-10 روی mes.GetSubcontract* و mes.GetTolling* (فقط‌خواندنی). */
@Injectable({ providedIn: 'root' })
export class FrmPc10Service {
  constructor(private http: HttpClient) {}

  bundle(companyId = DEMO_COMPANY_ID): Observable<Pc10Bundle> {
    return this.http.get<Record<string, Row[]>>(`${API_BASE_URL}/api/pc10/bundle`, { params: { companyId } }).pipe(
      map((b) => {
        const items = (b['items'] ?? []).map(mapItem);
        return {
          orders: (b['orders'] ?? []).map(mapSubOrder),
          progress: (b['progress'] ?? []).map(mapProgress).sort((x, y) => s(x.reportedAt).localeCompare(s(y.reportedAt))),
          shipments: mapShipments(b['shipments'] ?? [], items),
          recon: (b['recon'] ?? []).map(mapRecon),
          contracts: (b['contracts'] ?? []).map(mapContract),
          statement: (b['statement'] ?? []).map(mapStatement),
          stock: (b['stock'] ?? []).map(mapStock),
          consumption: (b['consumption'] ?? []).map(mapConsumption),
        };
      })
    );
  }
}
