import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'gng-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet></router-outlet>`,
})
export class AppComponent {
  // inject می‌شود تا مد رنگی (localStorage یا prefers-color-scheme) همان
  // لحظه‌ی بوت‌استرپ اعمال شود، نه با تأخیر بعد از رندر اولین کامپوننت.
  private readonly themeService = inject(ThemeService);
}
