import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { mapContract, mapItem, mapProgress, mapRecon, mapShipments, mapStatement, mapSubOrder } from './frm-pc-10.service';
import { PortalAccount, PortalView, TollOperation } from './frm-pc-11.data';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const n = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

const mapAccount = (r: Row): PortalAccount => ({
  id: r['AccountId'], userName: s(r['UserName']), displayName: s(r['DisplayName']), partyTypeCode: n(r['PartyTypeCode']),
  contractorId: r['ContractorId'] ?? null, contractor: s(r['ContractorTitle']), contractId: r['TollingContractId'] ?? null, customer: s(r['CustomerTitle']),
  contractNumber: s(r['ContractNumber']), canReport: !!r['CanReportProgress'], canBalances: !!r['CanViewBalances'], canFees: !!r['CanViewFees'],
  lastLogin: r['LastLoginAt'], active: !!r['IsActive'], description: s(r['Description']),
});

const mapOperation = (r: Row): TollOperation => ({
  workOrderId: r['WorkOrderId'], workOrder: s(r['WorkOrderNumber']), batch: s(r['BatchNumber']), quantity: n(r['Quantity']), woStatusCode: n(r['WorkOrderStatusCode']),
  dueDate: r['DueDate'], seq: n(r['Sequence']), title: s(r['OperationTitle']), statusCode: n(r['OperationStatusCode']), toComplete: n(r['ToCompleteQuantity']),
  completed: n(r['CompletedQuantity']), wasted: n(r['WastedQuantity']), start: r['StartTime'], end: r['EndTime'], description: s(r['Description']),
});

/** FRM-PC-11 روی mes.GetPortalAccounts و mes.GetPortalView (سرور طرف را از حساب پیدا می‌کند و کارمزد را در صورت نداشتن مجوز null می‌کند). */
@Injectable({ providedIn: 'root' })
export class FrmPc11Service {
  constructor(private http: HttpClient) {}

  accounts(companyId = DEMO_COMPANY_ID): Observable<PortalAccount[]> {
    return this.http
      .get<{ accounts: Row[] }>(`${API_BASE_URL}/api/pc11/bundle`, { params: { companyId } })
      .pipe(map((b) => (b.accounts ?? []).map(mapAccount)));
  }

  view(accountId: number, companyId = DEMO_COMPANY_ID): Observable<PortalView> {
    return this.http.get<Record<string, any>>(`${API_BASE_URL}/api/pc11/view`, { params: { companyId, accountId } }).pipe(
      /* حساب غیرفعال: سرور ۴۰۳ با خود حساب و بدون داده برمی‌گرداند */
      catchError((e) => (e?.status === 403 && e.error?.account ? of(e.error as Record<string, any>) : throwError(() => e))),
      map((b) => {
        const a: Row = b['account'] ?? {};
        const party = n(a['PartyTypeCode']);
        const items = ((b['items'] ?? []) as Row[]).map(mapItem);
        const arr = (k: string): Row[] => (b[k] ?? []) as Row[];
        const rowCount = ['orders', 'progress', 'shipments', 'items', 'balances', 'contracts', 'operations'].reduce((acc, k) => acc + arr(k).length, 0);
        return {
          accountId: n(a['AccountId']),
          partyTypeCode: party,
          canViewBalances: !!a['CanViewBalances'],
          canViewFees: !!a['CanViewFees'],
          isActive: !!a['IsActive'],
          orders: arr('orders').map(mapSubOrder),
          progress: arr('progress').map(mapProgress).sort((x, y) => s(x.reportedAt).localeCompare(s(y.reportedAt))),
          shipments: mapShipments(arr('shipments'), items),
          subBalances: party === 1 ? arr('balances').map(mapRecon) : [],
          contracts: arr('contracts').map(mapContract),
          tollBalances: party === 2 ? arr('balances').map(mapStatement) : [],
          operations: arr('operations').map(mapOperation).sort((x, y) => x.seq - y.seq),
          rowCount,
        };
      })
    );
  }
}
