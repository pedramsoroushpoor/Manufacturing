import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormCodeChipComponent } from '../form-code-chip/form-code-chip.component';

export type BannerTone = 'info' | 'warning' | 'danger' | 'success';

/**
 * پوسته‌ی مشترک همه‌ی «فرم‌های عملیاتی چکش‌کاری‌شده» — بردکرامب، هدر (چیپ
 * زمینه + عنوان + کد فرم)، نوار ابزار (projection)، بنر راهنما با چهار
 * لحن ممکن (مطابق ماک‌آپ‌های اصلی که رنگ بنر بسته به وضعیت فرق می‌کند)،
 * بدنه‌ی دو‌ستونه (تب‌ها + پنل زمینه‌ی اختیاری)، و نوار پایین ممیزی.
 * هر فرم اختصاصی فقط محتوای تب‌ها/ابزار/پنل زمینه را از طریق
 * ng-content پر می‌کند.
 */
@Component({
  selector: 'gng-opform-layout',
  standalone: true,
  imports: [CommonModule, FormCodeChipComponent],
  templateUrl: './operational-form-layout.component.html',
  styleUrl: './operational-form-layout.component.scss',
})
export class OperationalFormLayoutComponent {
  @Input() domainTitle = 'مدیریت منابع';
  @Input({ required: true }) title!: string;
  @Input({ required: true }) code!: string;
  @Input() formTypeLabel = 'فرم اطلاعات پایه';
  @Input() owner = 'دفتر فنی';
  @Input() contextLabel?: string;
  @Input() contextIcon = 'pi pi-tag';

  @Input() bannerText?: string;
  @Input() bannerTone: BannerTone = 'info';
  @Input() bannerIcon?: string;

  @Input() hasContextPanel = false;
  @Input() contextPanelTitle = '';
  @Input() contextPanelHint = '';

  @Input() auditFeatureRange = '';
  @Input() auditRegisteredBy = 'سمانه مصطفایی';
  @Input() auditApprovedBy = 'دکتر نوروزی — مدیر فنی';

  get bannerIconClass(): string {
    if (this.bannerIcon) return this.bannerIcon;
    switch (this.bannerTone) {
      case 'success':
        return 'pi pi-check-circle';
      case 'warning':
        return 'pi pi-exclamation-triangle';
      case 'danger':
        return 'pi pi-ban';
      default:
        return 'pi pi-info-circle';
    }
  }
}
