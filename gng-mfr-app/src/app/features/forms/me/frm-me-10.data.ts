/** مدل‌های نمایشی FRM-ME-10 «فعالیت و محرک هزینه‌ی عملیات». */
import { RoutingRow } from './me-routing';

export interface ActivityRow {
  routingId: number;
  routingOperationId: number;
  operationSequence: number;
  operation: string;
  natureCode: number;
  sequence: number | null;
  activityId: number | null;
  activity: string;
  level: string;
  minutes: number | null;
  mandatory: boolean;
  valueAdded: boolean | null;
  standardCost: number | null;
  description: string;
  driver: string;
  driverCapacity: string;
  capacityAllowed: boolean | null;
  libraryActivityCount: number;
}

export interface ShareRow {
  routingId: number;
  routingOperationId: number;
  sequence: number;
  operation: string;
  product: string;
  typeCode: number;
  type: string;
  quantity: number;
  unit: string;
  share: number | null;
}

export interface Me10Bundle {
  routings: RoutingRow[];
  activities: ActivityRow[];
  shares: ShareRow[];
}

export interface Issue {
  severity: 'danger' | 'warning';
  text: string;
}
