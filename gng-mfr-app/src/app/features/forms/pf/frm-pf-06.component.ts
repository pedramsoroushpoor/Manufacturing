import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { OperationalFormLayoutComponent } from '../../../shared/operational-form-layout/operational-form-layout.component';
import {
  ALCOA_NOTE,
  AUDIT_LOG,
  AUDIT_RANGE,
  AUDIT_TRAIL_NOTE,
  BANNER_INFO,
  COMPLIANCE_ITEMS,
  DELETE_NOTE,
  NO_DELETE_NOTE,
  SIGNATURE_MECH_NOTE,
  SIGNATURE_NOTE,
  SIGNATURE_POINTS,
  STAT_AUDIT_RECORDS,
  STAT_SIGNATURES,
} from './frm-pf-06.data';

@Component({
  selector: 'gng-frm-pf-06',
  standalone: true,
  imports: [CommonModule, ButtonModule, TabViewModule, TableModule, TagModule, OperationalFormLayoutComponent],
  templateUrl: './frm-pf-06.component.html',
})
export class FrmPf06Component {
  readonly signaturePoints = SIGNATURE_POINTS;
  readonly signatureNote = SIGNATURE_NOTE;
  readonly complianceItems = COMPLIANCE_ITEMS;
  readonly statSignatures = STAT_SIGNATURES;
  readonly statAuditRecords = STAT_AUDIT_RECORDS;
  readonly deleteNote = DELETE_NOTE;
  readonly auditLog = AUDIT_LOG;
  readonly bannerInfo = BANNER_INFO;
  readonly auditTrailNote = AUDIT_TRAIL_NOTE;
  readonly signatureMechNote = SIGNATURE_MECH_NOTE;
  readonly alcoaNote = ALCOA_NOTE;
  readonly noDeleteNote = NO_DELETE_NOTE;
  readonly auditRange = AUDIT_RANGE;

  pointSeverity(status: string): 'success' | 'warning' {
    return status === 'فعال' ? 'success' : 'warning';
  }
}
