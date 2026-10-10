import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { ShellComponent } from './layout/shell/shell.component';
import { LoginComponent } from './pages/login/login.component';
import { SessionService } from './core/session.service';

/** بدون دیتابیس هیچ‌چیزی خواندنی نیست، پس همه‌ی صفحات جز Login به آن‌جا
 *  هدایت می‌شوند وقتی نشستی باز نیست. روی خودِ روت ShellComponent گذاشته
 *  شده تا همه‌ی مسیرهای زیرش (dashboard، forms/:formCode، ...) با یک گارد
 *  محافظت شوند. */
const connected = () => {
  const session = inject(SessionService);
  const router = inject(Router);
  return session.token ? true : router.createUrlTree(['/login']);
};

// یک روت عمومی «forms/:formCode» هر آیتم منوی سطح ۲ را (که FormCode از
// alm.Menu دارد) به FormPageComponent می‌رساند؛ آن کامپوننت خودش از
// forms-registry.ts پیکربندی فرم را با کلید FormCode پیدا می‌کند. یعنی
// افزودن حوزه‌ی بعدی (PE/ME/PC/PF) فقط یک فایل داده اضافه می‌کند، نه روت.
export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: ShellComponent,
    canActivate: [connected],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        // ابزار توسعه: مقایسه‌ی جدول‌ها و فیلدهای دو دسته اسکیما.
        path: 'db-compare',
        loadComponent: () =>
          import('./features/db-compare/db-compare.component').then((m) => m.DbCompareComponent),
      },
      {
        // شناسنامه‌ی فرم در ALM — با کلیک روی کد فرم در تب جدا باز می‌شود.
        path: 'alm/forms/:formCode',
        loadComponent: () =>
          import('./features/alm/alm-form-spec.component').then((m) => m.AlmFormSpecComponent),
      },
      {
        path: 'forms/:formCode',
        loadComponent: () =>
          import('./features/forms/form-page.component').then((m) => m.FormPageComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
