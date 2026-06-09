import { Component, inject } from '@angular/core';
import { ViewportScaleService, ViewScalePercent } from '../services/viewport-scale.service';

@Component({
  selector: 'app-viewport-scale-control',
  standalone: true,
  template: `
    <nav class="viewport-scale-control hidden md:flex" aria-label="Ajuste de visualização da tela">
      <span class="viewport-scale-control__label">Tela</span>
      @for (option of viewport.options; track option) {
        <button
          type="button"
          class="viewport-scale-control__btn"
          [class.viewport-scale-control__btn--active]="viewport.scale() === option"
          [attr.aria-pressed]="viewport.scale() === option"
          (click)="setScale(option)"
        >
          {{ option }}%
        </button>
      }
    </nav>
  `,
})
export class ViewportScaleControlComponent {
  readonly viewport = inject(ViewportScaleService);

  setScale(percent: ViewScalePercent): void {
    this.viewport.setScale(percent);
  }
}
