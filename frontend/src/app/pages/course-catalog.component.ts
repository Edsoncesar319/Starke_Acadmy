import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PortalDataService } from '../services/portal-data.service';

@Component({
  selector: 'app-course-catalog',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="space-y-4">
      <div class="flex flex-col gap-3 rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-4 lg:flex-row">
        <input
          [ngModel]="query()"
          (ngModelChange)="query.set($event)"
          placeholder="Buscar cursos..."
          class="w-full rounded-lg border border-gold-500/30 bg-obsidian-800 px-4 py-2 text-sm outline-none"
        />
        <select
          [ngModel]="category()"
          (ngModelChange)="category.set($event)"
          class="rounded-lg border border-gold-500/30 bg-obsidian-800 px-4 py-2 text-sm outline-none"
        >
          <option value="Todas">Todas as categorias</option>
          @for (item of categories(); track item) {
            <option [value]="item">{{ item }}</option>
          }
        </select>
      </div>

      <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
        @for (course of filteredCourses(); track course.id) {
          <article class="overflow-hidden rounded-xl border border-gold-500/20 bg-obsidian-700/60">
            <img [src]="course.heroImageUrl" [alt]="course.title" class="h-40 w-full object-cover" />
            <div class="space-y-2 p-4">
              <p class="text-xs uppercase tracking-wider text-gold-300">{{ course.category }} - {{ course.rating }}</p>
              <h3 class="text-lg font-semibold">{{ course.title }}</h3>
              <p class="text-sm text-slate-300">{{ course.description }}</p>
              <div class="mt-4 flex items-center justify-between">
                <span class="text-gold-300">{{ formatPrice(course.price) }}</span>
                <button
                  (click)="enroll(course.id)"
                  class="rounded-lg border border-gold-500/40 px-3 py-2 text-xs font-semibold text-gold-300 transition hover:bg-gold-500/20"
                >
                  Matricular-se
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

  async enroll(courseId: number): Promise<void> {
    await this.data.enrollInCourse(courseId);
    if (this.data.pixCheckout()) {
      await this.router.navigateByUrl(`/pagamento/${courseId}`);
    }
  }
}
