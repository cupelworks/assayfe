import { Component, inject, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CatalogStore } from '../api/catalog.store';
import { ThemeService } from '../theme/theme.service';
import { AssayApiService } from '../api/assay-api.service';
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
  apiBase = inject(AssayApiService).base;
  ngOnInit() {
    this.store.load();
  }
}
