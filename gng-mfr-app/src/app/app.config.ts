import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { sessionInterceptor } from './core/session.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    // هر تماس API توکن نشست را حمل می‌کند؛ به session.interceptor.ts نگاه کنید.
    provideHttpClient(withFetch(), withInterceptors([sessionInterceptor])),
  ],
};
