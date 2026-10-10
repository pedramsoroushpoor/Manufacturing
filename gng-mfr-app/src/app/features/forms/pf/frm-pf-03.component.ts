import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { OperationalFormLayoutComponent } from '../../../shared/operational-form-layout/operational-form-layout.component';
import {
  AccessLevel,
  ACCESS_MATRIX,
  ACCESS_ROLES,
  AUDIT_RANGE,
  CUSTOM_STATUSES,
  DELEGATIONS,
  DELEGATION_NOTE,
  DESIGN_PRINCIPLE_NOTE,
  FIELD_ACCESS,
  STATUS_NOTE,
  WORKFLOW_BANNER,
  WORKFLOW_ENTITY,
  WORKFLOW_NODES,
} from './frm-pf-03.data';

@Component({
  selector: 'gng-frm-pf-03',
  standalone: true,
  imports: [CommonModule, ButtonModule, TabViewModule, TableModule, TagModule, OperationalFormLayoutComponent],
  templateUrl: './frm-pf-03.component.html',
})
export class FrmPf03Component {
  readonly workflowNodes = WORKFLOW_NODES;
  readonly workflowEntity = WORKFLOW_ENTITY;
  readonly workflowBanner = WORKFLOW_BANNER;
  readonly customStatuses = CUSTOM_STATUSES;
  readonly statusNote = STATUS_NOTE;
  readonly delegations = DELEGATIONS;
  readonly delegationNote = DELEGATION_NOTE;
  readonly designPrincipleNote = DESIGN_PRINCIPLE_NOTE;
  readonly accessRoles = ACCESS_ROLES;
  readonly accessMatrix = ACCESS_MATRIX;
  readonly fieldAccess = FIELD_ACCESS;
  readonly auditRange = AUDIT_RANGE;

  nodeClass(variant: string): string {
    return 'gng-diagram-node gng-diagram-node--' + variant;
  }

  nodeStyle(node: { col: number; row: number }): string {
    return `grid-column: ${node.col + 1}; grid-row: ${node.row + 1};`;
  }

  accessIcon(level: AccessLevel): string {
    switch (level) {
      case 'view':
        return 'pi pi-eye';
      case 'edit':
        return 'pi pi-pencil';
      case 'approve':
        return 'pi pi-check';
      default:
        return 'pi pi-minus';
    }
  }

  accessClass(level: AccessLevel): string {
    switch (level) {
      case 'view':
        return 'gng-sym--ok';
      case 'edit':
        return 'gng-sym--warn';
      case 'approve':
        return 'gng-sym--ok';
      default:
        return 'gng-sym--no';
    }
  }
}
