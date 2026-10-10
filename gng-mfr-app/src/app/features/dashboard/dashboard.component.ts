import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

interface DomainCard {
  code: string;
  title: string;
  description: string;
  icon: string;
  colorVar: string;
  formCount: number;
  firstFormCode: string;
}

@Component({
  selector: 'gng-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  constructor(private readonly router: Router) {}

  readonly stats = [
    { label: 'فرم عملیاتی', value: '۴۷', icon: 'pi pi-file-edit' },
    { label: 'فیچر پوشش‌داده‌شده', value: '۳۶۰', icon: 'pi pi-verified' },
    { label: 'حوزه‌ی کامل‌شده', value: '۵ از ۵', icon: 'pi pi-check-circle' },
    { label: 'پوشش ماتریس ردیابی', value: '۱۰۰٪', icon: 'pi pi-link' },
  ];

  readonly domains: DomainCard[] = [
    {
      code: 'PF',
      title: 'چارچوب مشترک',
      description: 'پیکربندی پلتفرم، نسخه و اعتبار، گردش کار و دسترسی، توسعه‌پذیری، یکپارچگی و انطباق',
      icon: 'pi pi-sliders-h',
      colorVar: 'var(--gng-teal)',
      formCount: 7,
      firstFormCode: 'FRM-PF-01',
    },
    {
      code: 'RM',
      title: 'مدیریت منابع',
      description: 'خطوط تولید، تجهیزات، نیروی کار، شیفت، تقویم، ظرفیت و پیمانکاران',
      icon: 'pi pi-users',
      colorVar: 'var(--gng-info)',
      formCount: 9,
      firstFormCode: 'FRM-RM-01',
    },
    {
      code: 'PE',
      title: 'مهندسی محصول',
      description: 'ساختار محصول، فرمولاسیون، جایگزینی، پیکربندی و تغییر مهندسی (ECO)',
      icon: 'pi pi-box',
      colorVar: 'var(--gng-success)',
      formCount: 9,
      firstFormCode: 'FRM-PE-01',
    },
    {
      code: 'ME',
      title: 'مهندسی تولید',
      description: 'روش ساخت، عملیات، کارکرد استاندارد، برون‌سپاری، نسخه‌ی تولید و هزینه',
      icon: 'pi pi-cog',
      colorVar: 'var(--gng-purple)',
      formCount: 10,
      firstFormCode: 'FRM-ME-01',
    },
    {
      code: 'PC',
      title: 'کنترل تولید',
      description: 'درخواست، دستور کار، مصرف، تولید، کیفیت، ضایعات و پایش کارخانه',
      icon: 'pi pi-chart-line',
      colorVar: 'var(--gng-primary)',
      formCount: 12,
      firstFormCode: 'FRM-PC-01',
    },
  ];

  openDomain(domain: DomainCard): void {
    this.router.navigate(['/forms', domain.firstFormCode]);
  }
}
