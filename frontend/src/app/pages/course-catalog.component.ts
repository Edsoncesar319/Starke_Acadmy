import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdaptiveCourseImageComponent } from '../shared/adaptive-course-image.component';
import { PortalDataService } from '../services/portal-data.service';

@Component({
  selector: 'app-course-catalog',
  standalone: true,
  imports: [FormsModule, AdaptiveCourseImageComponent],
  template: `
    <section class="page-section">
      @if (data.status()) {
        <p class="rounded-lg border border-emerald-500/30 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-300">
          {{ data.status() }}
        </p>
      }
      @if (data.error()) {
        <p class="rounded-lg border border-red-400/30 bg-red-900/20 px-4 py-3 text-sm text-red-300">
          {{ data.error() }}
        </p>
      }

      <div class="panel flex flex-col gap-3 lg:flex-row">
        <input
          [ngModel]="query()"
          (ngModelChange)="query.set($event)"
          placeholder="Buscar cursos..."
          class="form-input"
        />
        <select
          [ngModel]="category()"
          (ngModelChange)="category.set($event)"
          class="form-input lg:max-w-xs"
        >
          <option value="Todas">Todas as categorias</option>
          @for (item of categories(); track item) {
            <option [value]="item">{{ item }}</option>
          }
        </select>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        @for (course of filteredCourses(); track course.id) {
          <article class="overflow-hidden rounded-xl border border-gold-500/20 bg-obsidian-700/60">
            <app-adaptive-course-image
              [imageUrl]="course.heroImageUrl"
              [alt]="'Capa do curso ' + course.title"
              variant="card"
            />
            <div class="space-y-2 p-4">
              <p class="text-xs uppercase tracking-wider text-gold-300">{{ course.category }} - {{ course.rating }}</p>
              <h3 class="text-lg font-semibold">{{ course.title }}</h3>
              <p class="line-clamp-desc text-sm text-slate-300">{{ course.description }}</p>
              <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span class="text-base font-medium text-gold-300 sm:text-sm">{{ formatPrice(course.price) }}</span>
                <button
                  type="button"
                  (click)="enroll(course.id)"
                  [disabled]="enrollingId() === course.id || isEnrolled(course.id)"
                  class="btn-outline w-full sm:w-auto disabled:opacity-60"
                >
                  {{
                    isEnrolled(course.id)
                      ? 'Já matriculado'
                      : enrollingId() === course.id
                        ? 'Matriculando...'
                        : 'Matricular-se'
                  }}
                </button>
              </div>
            </div>
          </article>
        }
      </div>

    </section>
  `,
})
export class CourseCatalogComponent {
  readonly data = inject(PortalDataService);
  private readonly router = inject(Router);
  readonly query = signal('');
  readonly category = signal('Todas');
  readonly enrollingId = signal<number | null>(null);

  readonly categories = computed(() => {
    const values = new Set(this.data.courses().map((course) => course.category).filter(Boolean));
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  });

  readonly filteredCourses = computed(() =>
    this.data.courses().filter((course) => {
      const byText = course.title.toLowerCase().includes(this.query().toLowerCase());
      const byCategory = this.category() === 'Todas' || course.category === this.category();
      return byText && byCategory;
    }),
  );

  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price || 0);
  }

  isEnrolled(courseId: number): boolean {
    return this.data.enrollments().some((item) => item.courseId === courseId);
  }

  async enroll(courseId: number): Promise<void> {
    if (this.isEnrolled(courseId)) {
      const course = this.data.courses().find((item) => item.id === courseId);
      this.data.status.set(`Você já está matriculado em "${course?.title ?? 'este curso'}".`);
      return;
    }

    this.enrollingId.set(courseId);
    const result = await this.data.enrollInCourse(courseId);
    this.enrollingId.set(null);

    if (result === 'payment' && this.data.pixCheckout()) {
      await this.router.navigateByUrl(`/pagamento/${courseId}`);
    }
  }
}
