import { Injectable, signal } from '@angular/core';

export type ViewScalePercent = 80 | 90 | 100 | 110;

const STORAGE_KEY = 'starke-view-scale';
const VALID_SCALES: ViewScalePercent[] = [80, 90, 100, 110];

@Injectable({ providedIn: 'root' })
export class ViewportScaleService {
  readonly scale = signal<ViewScalePercent>(100);
  readonly options = VALID_SCALES;

  constructor() {
    this.restore();
  }

  setScale(percent: ViewScalePercent): void {
    this.scale.set(percent);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(percent));
    }
    this.apply(percent);
  }

  private restore(): void {
    if (typeof document === 'undefined') return;

    const saved = Number(localStorage.getItem(STORAGE_KEY));
    const percent = VALID_SCALES.includes(saved as ViewScalePercent) ? (saved as ViewScalePercent) : 100;
    this.scale.set(percent);
    this.apply(percent);
  }

  private apply(percent: ViewScalePercent): void {
    if (typeof document === 'undefined') return;

    const factor = percent / 100;
    const root = document.documentElement;
    root.style.setProperty('--starke-view-scale', String(factor));
    root.dataset['viewScale'] = String(percent);
    root.classList.toggle('starke-view-scaled', percent !== 100);
  }
}
