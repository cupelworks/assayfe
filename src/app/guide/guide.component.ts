import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatusMarkComponent } from '../shared/status-mark.component';

@Component({
  selector: 'assay-guide',
  standalone: true,
  imports: [RouterLink, StatusMarkComponent],
  templateUrl: './guide.component.html',
  styleUrls: ['../shared/page.css', './guide.component.css'],
})
export class GuideComponent {}
