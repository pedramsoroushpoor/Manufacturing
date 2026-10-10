import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { ApprovalRow, ApprovalRule, Feasibility, LinkedOrder, RequestRow } from './frm-pc-01.data';

interface ApiRequest {
  RequestId: number; Number: string; RequestDate: string | null; OriginCode: number; PriorityCode: number; ProductId: number; ProductCode: string; ProductTitle: string;
  UnitTitle: string | null; ProductGroupTitle: string | null; Quantity: number; NeedDate: string | null; RequesterUnitTitle: string | null; RequesterTitle: string | null;
  GeneralRequisitionNumber: string | null; SalesOrderNumber: string | null; CustomerTitle: string | null; StatusCode: number; Description: string | null; OrderedQuantity: number;
}
interface ApiApproval {
  RequestId: number; Sequence: number; ApproverRoleTitle: string; ApproverTitle: string | null; DecisionCode: number | null; DecisionDate: string | null; Comment: string | null;
}
interface ApiRule {
  Sequence: number; OriginCode: number | null; MinQuantity: number | null; ProductGroupTitle: string | null; RequesterUnitTitle: string | null; ApproverRoleTitle: string; Description: string | null;
}
interface ApiOrder {
  WorkOrderId: number; Number: string; Name: string; WOTypeCode: number; StatusCode: number; Quantity: number; UnitTitle: string | null; LineTitle: string | null;
  PlannedCompleteDate: string | null; ActualCompleteDate: string | null; DueDate: string | null; LastOpCompleted: number | null; CurrentOperation: string | null;
  OperationCount: number; OperationsDone: number; Requests: string | null;
}
interface ApiOperation {
  WorkOrderId: number; Sequence: number; OperationTitle: string; StatusCode: number; ToCompleteQuantity: number | null; CompletedQuantity: number | null;
}
interface ApiFeas {
  summary: {
    VersionId: number | null; VersionCode: string | null; VersionTitle: string | null; StructureCode: string | null; LeadTimeHours: number | null; BatchCount: number | null; NeedDate: string | null;
  } | null;
  materials: { Sequence: number; ProductCode: string; ProductTitle: string; UnitTitle: string | null; Required: number; Available: number; InTransit: number; LastArrival: string | null }[];
}

/** FRM-PC-01 روی /api/pc01/bundle، /api/pc01/feasibility و دستورهای /api/pc02/bundle (پیوند دوطرفه و پیشرفت). */
@Injectable({ providedIn: 'root' })
export class FrmPc01Service {
  constructor(private http: HttpClient) {}

  bundle(companyId = DEMO_COMPANY_ID): Observable<{ requests: RequestRow[]; approvals: ApprovalRow[]; rules: ApprovalRule[] }> {
    return this.http
      .get<{ requests: ApiRequest[]; approvals: ApiApproval[]; rules: ApiRule[] }>(`${API_BASE_URL}/api/pc01/bundle`, { params: { companyId } })
      .pipe(
        map((b) => ({
          requests: b.requests.map((r) => ({
            id: r.RequestId,
            number: r.Number,
            requestDate: r.RequestDate,
            originCode: r.OriginCode,
            priorityCode: r.PriorityCode,
            productId: r.ProductId,
            productCode: r.ProductCode,
            productTitle: r.ProductTitle,
            unit: r.UnitTitle ?? '',
            productGroup: r.ProductGroupTitle ?? '',
            quantity: Number(r.Quantity),
            needDate: r.NeedDate,
            requesterUnit: r.RequesterUnitTitle ?? '',
            requester: r.RequesterTitle ?? '',
            generalRequisition: r.GeneralRequisitionNumber ?? '',
            salesOrder: r.SalesOrderNumber ?? '',
            customer: r.CustomerTitle ?? '',
            statusCode: r.StatusCode,
            description: r.Description ?? '',
            orderedQuantity: Number(r.OrderedQuantity ?? 0),
          })),
          approvals: b.approvals.map((a) => ({
            requestId: a.RequestId,
            sequence: a.Sequence,
            role: a.ApproverRoleTitle,
            approver: a.ApproverTitle ?? '',
            decisionCode: a.DecisionCode,
            decisionDate: a.DecisionDate,
            comment: a.Comment ?? '',
          })),
          rules: b.rules.map((r) => ({
            sequence: r.Sequence,
            originCode: r.OriginCode,
            minQuantity: r.MinQuantity,
            productGroup: r.ProductGroupTitle,
            requesterUnit: r.RequesterUnitTitle,
            role: r.ApproverRoleTitle,
            description: r.Description ?? '',
          })),
        }))
      );
  }

  /** دستورهای کار با شماره‌ی درخواست‌های متصل و پیشرفت عملیات */
  orders(companyId = DEMO_COMPANY_ID): Observable<LinkedOrder[]> {
    return this.http.get<{ orders: ApiOrder[]; operations: ApiOperation[] }>(`${API_BASE_URL}/api/pc02/bundle`, { params: { companyId } }).pipe(
      map((b) =>
        b.orders.map((o) => ({
          id: o.WorkOrderId,
          number: o.Number,
          name: o.Name,
          typeCode: o.WOTypeCode,
          statusCode: o.StatusCode,
          quantity: Number(o.Quantity),
          unit: o.UnitTitle ?? '',
          line: o.LineTitle ?? '',
          plannedComplete: o.PlannedCompleteDate,
          actualComplete: o.ActualCompleteDate,
          due: o.DueDate,
          produced: Number(o.LastOpCompleted ?? 0),
          currentOperation: o.CurrentOperation ?? '',
          operationCount: o.OperationCount,
          operationsDone: o.OperationsDone,
          requestNumbers: (o.Requests ?? '').split(/[،,]/).map((s) => s.trim()).filter((s) => !!s),
          ops: b.operations
            .filter((x) => x.WorkOrderId === o.WorkOrderId)
            .sort((x, y) => x.Sequence - y.Sequence)
            .map((x) => ({
              seq: x.Sequence,
              title: x.OperationTitle,
              statusCode: x.StatusCode,
              pct: x.ToCompleteQuantity ? Math.min(100, (100 * Number(x.CompletedQuantity ?? 0)) / Number(x.ToCompleteQuantity)) : 0,
            })),
        }))
      )
    );
  }

  /** امکان‌سنجی زنده؛ asOf = YYYY-MM-DD */
  feasibility(requestId: number, asOf: string): Observable<Feasibility> {
    return this.http.get<ApiFeas>(`${API_BASE_URL}/api/pc01/feasibility`, { params: { requestId, asOf } }).pipe(
      map((f) => ({
        summary: f.summary
          ? {
              versionId: f.summary.VersionId,
              versionCode: f.summary.VersionCode ?? '',
              versionTitle: f.summary.VersionTitle ?? '',
              structureCode: f.summary.StructureCode ?? '',
              leadTimeHours: f.summary.LeadTimeHours === null ? null : Number(f.summary.LeadTimeHours),
              batchCount: f.summary.BatchCount,
              needDate: f.summary.NeedDate,
            }
          : null,
        materials: f.materials.map((m) => ({
          sequence: m.Sequence,
          productCode: m.ProductCode,
          productTitle: m.ProductTitle,
          unit: m.UnitTitle ?? '',
          required: Number(m.Required),
          available: Number(m.Available),
          inTransit: Number(m.InTransit),
          lastArrival: m.LastArrival,
        })),
      }))
    );
  }
}
