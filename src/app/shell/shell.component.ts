import { Component, inject, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CatalogStore } from '../api/catalog.store';
import { ThemeService } from '../theme/theme.service';
import { ASSAY_API_BASE } from '../api/api-base.token';
@Component({
  selector: 'assay-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent implements OnInit {
  store = inject(CatalogStore);
  theme = inject(ThemeService);
  apiBase = inject(ASSAY_API_BASE).replace(/\/$/, '');
  ngOnInit() {
    this.store.load();
  }
}
