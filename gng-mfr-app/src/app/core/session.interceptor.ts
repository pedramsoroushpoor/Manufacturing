import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { SessionService } from './session.service';

/**
 * توکن نشست را روی هر درخواست API مهر می‌زند، و وقتی سرور می‌گوید نشست از
 * بین رفته کاربر را به صفحه‌ی Login برمی‌گرداند — این حالت بعد از ری‌استارت
 * بک‌اند یا بی‌کاری طولانی پیش می‌آید و بدون این interceptor به شکل یک صفحه‌ی
 * خالیِ بی‌توضیح دیده می‌شد.
 */
export const sessionInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionService);
  const router = inject(Router);

  const token = session.token;
  const request = token ? req.clone({ setHeaders: { 'x-alm-session': token } }) : req;

  return next(request).pipe(
    catchError((err) => {
      if (err?.status === 401 && err?.error?.code === 'no-session') {
        session.clear();
        // بعد از ورود دوباره، به همین‌جا برگرد.
        router.navigate(['/login'], { queryParams: { next: router.url } });
      }
      return throwError(() => err);
    })
  );
};
