import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'assay-guide',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './guide.component.html',
  styleUrls: ['../shared/page.css', './guide.component.css'],
})
export class GuideComponent {}
