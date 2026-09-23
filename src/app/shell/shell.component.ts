import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeService } from '../theme/theme.service';
import { ASSAY_API_BASE } from '../api/api-base.token';
@Component({
  selector: 'assay-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent {
  theme = inject(ThemeService);
  apiBase = inject(ASSAY_API_BASE).replace(/\/$/, '');
}
