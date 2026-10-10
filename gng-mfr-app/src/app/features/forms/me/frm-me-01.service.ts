import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/api-config';
import { DEMO_COMPANY_ID } from '../rm/rm-scope';
import { Me01Bundle } from './frm-me-01.data';

interface ApiBundle {
  groups: { GroupId: number; ParentId: number | null; Code: string; Title: string; Description: string | null; Level: number; Path: string; SortOrder: number | null; OperationCount: number }[];
  operations: {
    OperationId: number; Code: string; Title: string; GroupId: number | null; GroupTitle: string | null; OperationTypeCode: number; IsActive: boolean;
    Description: string | null; ResourceCount: number; PrimaryResource: string | null; SkillCount: number; ToolCount: number; EnergyCount: number;
    ActiveInstructionCount: number; ParameterCount: number; ActivityCount: number;
  }[];
  resources: {
    OperationId: number; KindCode: 1 | 2 | 3 | 4; SubTypeCode: number | null; ResourceTitle: string; Scope: string | null; Quantity: number | null;
    UnitTitle: string | null; IsMandatory: boolean; IsPrimary: boolean | null; Priority: number | null; LevelCode: number | null; IsValid: boolean | null; Description: string | null;
  }[];
  instructions: {
    OperationId: number; Sequence: number | null; DocumentNumber: string; Title: string; RevisionNo: number; RevisionStatusCode: 1 | 2 | 3; MediaTypeCode: number;
    FileName: string | null; EffectiveDate: string | null; ApproverTitle: string | null; IsShownOnTerminal: boolean; InstructionDescription: string | null;
    NeededTools: string | null; NeededUniforms: string | null; IsMandatory: boolean;
  }[];
  parameters: {
    OperationId: number; Sequence: number | null; Name: string; UnitTitle: string | null; TargetValue: number | null; MinValue: number | null; MaxValue: number | null;
    SourceCode: number; SamplingIntervalMinutes: number | null; OutOfRangeActionCode: number; IsCritical: boolean;
  }[];
}

/* کدهای موقت؛ معنای هر کد در scripts/mes_frm_me01_setup.sql آمده است. */
export const NATURE: Record<number, string> = { 1: 'تولیدی', 2: 'کیفی', 3: 'تولیدی-کیفی', 4: 'اطلاعاتی', 5: 'برون‌سپاری', 6: 'انتقال/جابه‌جایی' };
const KIND: Record<number, string> = { 1: 'ایستگاه / گروه منبع', 2: 'مهارت', 3: 'ابزار', 4: 'انرژی / کارکرد' };
const SKILL_LEVEL: Record<number, string> = { 1: 'کارآموز', 2: 'با نظارت', 3: 'مستقل', 4: 'مربی' };
const REV_STATUS: Record<number, string> = { 1: 'پیش‌نویس', 2: 'تأییدشده', 3: 'منسوخ' };
const MEDIA: Record<number, [string, string]> = { 1: ['متن', 'pi pi-align-right'], 2: ['تصویر', 'pi pi-image'], 3: ['ویدئو', 'pi pi-video'], 4: ['PDF', 'pi pi-file-pdf'] };

const day = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('fa-IR-u-ca-persian', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';

/** FRM-ME-01 روی رویه‌های mes.GetOperationGroupTree … mes.GetOperationParameters (scripts/mes_frm_me01_setup.sql). */
@Injectable({ providedIn: 'root' })
export class FrmMe01Service {
  constructor(private http: HttpClient) {}

  load(companyId = DEMO_COMPANY_ID): Observable<Me01Bundle> {
    return this.http.get<ApiBundle>(`${API_BASE_URL}/api/me01/bundle`, { params: { companyId } }).pipe(
      map((b) => ({
        groups: b.groups.map((g) => ({
          id: g.GroupId,
          parentId: g.ParentId,
          code: g.Code,
          title: g.Title,
          description: g.Description ?? '',
          level: g.Level,
          path: g.Path,
          sortOrder: g.SortOrder ?? 999,
          operationCount: g.OperationCount,
        })),
        operations: b.operations.map((o) => ({
          id: o.OperationId,
          code: o.Code,
          title: o.Title,
          groupId: o.GroupId,
          group: o.GroupTitle ?? '—',
          typeCode: o.OperationTypeCode,
          nature: NATURE[o.OperationTypeCode] ?? '—',
          isActive: o.IsActive,
          description: o.Description ?? '',
          resourceCount: o.ResourceCount,
          primaryResource: o.PrimaryResource ?? '',
          skillCount: o.SkillCount,
          toolCount: o.ToolCount,
          energyCount: o.EnergyCount,
          activeInstructionCount: o.ActiveInstructionCount,
          parameterCount: o.ParameterCount,
          activityCount: o.ActivityCount,
        })),
        resources: b.resources.map((r) => ({
          operationId: r.OperationId,
          kindCode: r.KindCode,
          kind: r.KindCode === 1 ? (r.SubTypeCode === 2 ? 'گروه منبع' : 'ایستگاه کاری') : KIND[r.KindCode],
          title: r.ResourceTitle,
          scope: r.Scope ?? '',
          quantity: r.Quantity,
          unit: r.UnitTitle ?? '',
          mandatory: r.IsMandatory,
          isPrimary: r.IsPrimary,
          priority: r.Priority,
          level: r.LevelCode ? SKILL_LEVEL[r.LevelCode] ?? String(r.LevelCode) : '',
          isValid: r.IsValid,
          description: r.Description ?? '',
        })),
        instructions: b.instructions.map((i) => ({
          operationId: i.OperationId,
          sequence: i.Sequence,
          documentNumber: i.DocumentNumber,
          title: i.Title,
          revision: i.RevisionNo,
          statusCode: i.RevisionStatusCode,
          status: REV_STATUS[i.RevisionStatusCode],
          media: MEDIA[i.MediaTypeCode]?.[0] ?? '—',
          mediaIcon: MEDIA[i.MediaTypeCode]?.[1] ?? 'pi pi-file',
          fileName: i.FileName ?? '',
          effectiveDate: day(i.EffectiveDate),
          approver: i.ApproverTitle ?? '—',
          onTerminal: i.IsShownOnTerminal,
          body: i.InstructionDescription ?? '',
          neededTools: i.NeededTools ?? '',
          neededUniforms: i.NeededUniforms ?? '',
          mandatory: i.IsMandatory,
        })),
        parameters: b.parameters.map((p) => {
          const outside =
            p.TargetValue !== null &&
            ((p.MinValue !== null && p.TargetValue < p.MinValue) || (p.MaxValue !== null && p.TargetValue > p.MaxValue));
          const crossed = p.MinValue !== null && p.MaxValue !== null && p.MinValue > p.MaxValue;
          return {
            operationId: p.OperationId,
            sequence: p.Sequence,
            name: p.Name,
            unit: p.UnitTitle ?? '',
            target: p.TargetValue,
            min: p.MinValue,
            max: p.MaxValue,
            source: p.SourceCode === 2 ? 'PLC / حسگر' : 'دستی',
            sampling: p.SamplingIntervalMinutes,
            stopsLine: p.OutOfRangeActionCode === 2,
            critical: p.IsCritical,
            inconsistent: outside || crossed,
          };
        }),
      }))
    );
  }
}
