import { NgClass } from '@angular/common';
import { Component, Input, OnChanges, computed, signal } from '@angular/core';
import {
  COURSE_CARD_IMAGE_SIZES,
  COURSE_THUMB_IMAGE_SIZES,
  buildCourseImageSrc,
  buildCourseImageSrcSet,
} from '../utils/course-image.util';

export type CourseImageVariant = 'card' | 'thumb';

@Component({
  selector: 'app-adaptive-course-image',
  standalone: true,
  imports: [NgClass],
  template: `
    <div
      class="relative w-full overflow-hidden bg-obsidian-800/90"
      [ngClass]="containerClass"
    >
      @if (showImage()) {
        <img
          [src]="displaySrc()"
          [attr.srcset]="srcSet() || null"
          [attr.sizes]="sizesAttr"
          [alt]="alt"
          loading="lazy"
          decoding="async"
          fetchpriority="low"
          class="absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-300"
          [class.opacity-0]="loading()"
          [class.opacity-100]="!loading()"
          (load)="onLoad()"
          (error)="onError()"
        />
        @if (loading()) {
          <div
            class="absolute inset-0 animate-pulse bg-gradient-to-br from-obsidian-800 via-obsidian-700/80 to-obsidian-900"
            aria-hidden="true"
          ></div>
        }
      } @else {
        <div
          class="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-obsidian-800 to-obsidian-900 text-gold-500/50"
          aria-hidden="true"
        >
          <span class="material-symbols-rounded text-3xl">school</span>
          @if (variant === 'card') {
            <span class="text-[10px] uppercase tracking-wider text-slate-500">Starke Academy</span>
          }
        </div>
      }
    </div>
  `,
})
export class AdaptiveCourseImageComponent implements OnChanges {
  @Input({ required: true }) alt = 'Curso';
  @Input() imageUrl: string | null = null;
  @Input() variant: CourseImageVariant = 'card';

  readonly failed = signal(false);
  readonly loading = signal(true);

  get sizesAttr(): string {
    return this.variant === 'thumb' ? COURSE_THUMB_IMAGE_SIZES : COURSE_CARD_IMAGE_SIZES;
  }

  get containerClass(): Record<string, boolean> {
    return {
      'aspect-video': this.variant === 'card',
      'h-24': this.variant === 'thumb',
    };
  }

  ngOnChanges(): void {
    this.failed.set(false);
    this.loading.set(!!(this.imageUrl ?? '').trim());
  }

  readonly showImage = computed(() => !!(this.imageUrl ?? '').trim() && !this.failed());

  readonly displaySrc = computed(() => {
    const width = this.variant === 'thumb' ? 480 : 640;
    return buildCourseImageSrc(this.imageUrl, width);
  });

  readonly srcSet = computed(() => {
    if (!(this.imageUrl ?? '').trim()) return null;
    const widths = this.variant === 'thumb' ? [320, 480, 640] : undefined;
    return buildCourseImageSrcSet(this.imageUrl, widths);
  });

  onLoad(): void {
    this.loading.set(false);
  }

  onError(): void {
    this.failed.set(true);
    this.loading.set(false);
  }
}
