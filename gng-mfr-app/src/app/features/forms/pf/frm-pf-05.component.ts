import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { OperationalFormLayoutComponent } from '../../../shared/operational-form-layout/operational-form-layout.component';
import {
  ADJACENT_CONTRACTS,
  API_NOTE,
  AUDIT_RANGE,
  BANNER_DANGER,
  BANNER_WARNING,
  CONTRACT_NOTE,
  CRITICAL_NOTE,
  EQUIPMENT_LAYER_NOTE,
  EQUIPMENT_ROWS,
  EVENT_ARCH_NOTE,
  EVENT_CATALOG,
  HEALTH_STATS,
  WEBHOOK_NOTE,
} from './frm-pf-05.data';

@Component({
  selector: 'gng-frm-pf-05',
  standalone: true,
  imports: [CommonModule, ButtonModule, TabViewModule, TableModule, TagModule, OperationalFormLayoutComponent],
  templateUrl: './frm-pf-05.component.html',
})
export class FrmPf05Component {
  readonly healthStats = HEALTH_STATS;
  readonly adjacentContracts = ADJACENT_CONTRACTS;
  readonly criticalNote = CRITICAL_NOTE;
  readonly eventCatalog = EVENT_CATALOG;
  readonly equipmentRows = EQUIPMENT_ROWS;
  readonly bannerDanger = BANNER_DANGER;
  readonly bannerWarning = BANNER_WARNING;
  readonly contractNote = CONTRACT_NOTE;
  readonly eventArchNote = EVENT_ARCH_NOTE;
  readonly apiNote = API_NOTE;
  readonly equipmentLayerNote = EQUIPMENT_LAYER_NOTE;
  readonly webhookNote = WEBHOOK_NOTE;
  readonly auditRange = AUDIT_RANGE;

  statClass(tone: 'default' | 'success' | 'danger'): string {
    return tone === 'default' ? 'gng-stat-card' : 'gng-stat-card gng-stat-card--' + tone;
  }

  eventSeverity(status: string): 'success' | 'warning' {
    return status === 'سالم' ? 'success' : 'warning';
  }

  equipmentSeverity(status: string): 'success' | 'danger' {
    return status === 'متصل' ? 'success' : 'danger';
  }
}
