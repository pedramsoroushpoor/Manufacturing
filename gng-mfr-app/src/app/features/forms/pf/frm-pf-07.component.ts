import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { OperationalFormLayoutComponent } from '../../../shared/operational-form-layout/operational-form-layout.component';
import {
  AUDIT_RANGE,
  AUTO_MATRIX_NOTE,
  BANNER_SUCCESS,
  CHAIN_NOTE,
  COVERAGE_ROWS,
  COVERAGE_TOTAL,
  FEATURE_REF_NOTE,
  OPEN_DECISIONS,
  RECENT_REQUIREMENTS,
  REQ_CODE_NOTE,
  STAT_ESTIMATE,
  STAT_FEATURES,
  STAT_FORMS,
  STAT_REQUIREMENTS,
  TRACE_CHAIN,
  WARNING_NOTE,
} from './frm-pf-07.data';

@Component({
  selector: 'gng-frm-pf-07',
  standalone: true,
  imports: [CommonModule, ButtonModule, TabViewModule, TableModule, TagModule, OperationalFormLayoutComponent],
  templateUrl: './frm-pf-07.component.html',
})
export class FrmPf07Component {
  readonly traceChain = TRACE_CHAIN;
  readonly chainNote = CHAIN_NOTE;
  readonly statFeatures = STAT_FEATURES;
  readonly statRequirements = STAT_REQUIREMENTS;
  readonly statEstimate = STAT_ESTIMATE;
  readonly statForms = STAT_FORMS;
  readonly openDecisions = OPEN_DECISIONS;
  readonly warningNote = WARNING_NOTE;
  readonly coverageRows = COVERAGE_ROWS;
  readonly coverageTotal = COVERAGE_TOTAL;
  readonly recentRequirements = RECENT_REQUIREMENTS;
  readonly bannerSuccess = BANNER_SUCCESS;
  readonly reqCodeNote = REQ_CODE_NOTE;
  readonly featureRefNote = FEATURE_REF_NOTE;
  readonly autoMatrixNote = AUTO_MATRIX_NOTE;
  readonly auditRange = AUDIT_RANGE;

  reqStatusSeverity(status: string): 'warning' | 'success' {
    return status === 'پیشنهادشده' ? 'warning' : 'success';
  }

  barClass(pct: number): string {
    return pct >= 100 ? 'gng-kpi__bar-fill' : 'gng-kpi__bar-fill gng-kpi__bar-fill--warning';
  }
}
