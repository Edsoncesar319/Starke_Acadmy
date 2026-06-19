import { NgClass } from '@angular/common';
import { Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { PortalDataService } from '../services/portal-data.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NgClass],
  template: `
    <section class="page-section">
      <div class="panel-header">
        <p class="text-gold-300">Bem-vindo(a) de volta, {{ data.student().name }}</p>
        <h3 class="mt-2 text-xl font-semibold sm:text-2xl">Tarefas pendentes: {{ pendingTasks() }}</h3>
        @if (data.status()) {
          <p class="mt-2 text-sm text-gold-300">{{ data.status() }}</p>
        }
        @if (data.error()) {
          <p class="mt-2 text-sm text-red-300">{{ data.error() }}</p>
        }
      </div>

      <div>
        <h4 class="mb-3 text-lg font-medium text-gold-300">Cursos ativos</h4>
        @if (activeCoursesView().length === 0) {
          <p class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 px-4 py-6 text-center text-sm text-slate-400">
            Você não está matriculado em nenhum curso. Explore o catálogo para começar.
          </p>
        } @else {
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            @for (item of activeCoursesView(); track item.id) {
              <article class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-4">
                <div class="flex flex-wrap items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium text-slate-200">{{ item.course?.title }}</p>
                    <span
                      class="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                      [ngClass]="courseStatusClass(item.progressPercentage)"
                    >
                      {{ courseStatusLabel(item.progressPercentage) }}
                    </span>
                  </div>
                  <button
                    type="button"
                    (click)="removeEnrollment(item)"
                    [disabled]="removingEnrollmentId() === item.id"
                    class="btn-danger shrink-0 text-xs sm:text-sm"
                  >
                    {{ removingEnrollmentId() === item.id ? 'Removendo...' : 'Remover matrícula' }}
                  </button>
                </div>
                <div class="mt-3 flex items-center gap-3">
                  <div class="relative h-14 w-14 rounded-full border-4 border-gold-500/30">
                    <div
                      class="absolute inset-0 rounded-full border-4 border-gold-500"
                      [style.clip-path]="'inset(' + (100 - item.progressPercentage) + '% 0 0 0)'"
                    ></div>
                  </div>
                  <div>
                    <p class="text-xl font-semibold text-gold-300">{{ item.progressPercentage }}%</p>
                    <p class="text-xs text-slate-400">Progresso</p>
                  </div>
                </div>
              </article>
            }
          </div>
        }
      </div>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-4">
          <h4 class="mb-3 text-gold-300">Próximas ao vivo</h4>
          <ul class="space-y-2 text-sm text-slate-300">
            <li>Hoje 19:00 — Mentoria ao vivo</li>
            <li>Amanhã 20:30 — Clínica de produto</li>
            <li>Sábado 10:00 — Networking Elite</li>
          </ul>
        </div>
        <div class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-4">
          <h4 class="mb-3 text-gold-300">Explore nichos</h4>
          <div class="grid grid-cols-2 gap-2 text-xs text-slate-300 sm:grid-cols-3">
            @for (niche of niches; track niche) {
              <span class="rounded-lg border border-gold-500/20 bg-obsidian-600/60 px-3 py-2 text-center">{{ niche }}</span>
            }
          </div>
        </div>
      </div>
    </section>
  `,
})
export class DashboardComponent implements OnInit, OnDestroy {
  private static readonly PROGRESS_SYNC_MS = 2000;

  readonly data = inject(PortalDataService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly removingEnrollmentId = signal<number | null>(null);
  private progressTimer?: ReturnType<typeof setInterval>;
  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      void this.syncDashboard();
    }
  };
  private readonly onWindowFocus = (): void => {
    void this.syncDashboard();
  };

  readonly pendingTasks = computed(() => {
    this.data.progressTick();
    return this.data.activeCourses().filter((item) => item.progressPercentage < 100).length;
  });

  readonly activeCoursesView = computed(() => {
    this.data.progressTick();
    return this.data.activeCourses();
  });
  readonly niches = ['Tecnologia', 'Negócios', 'Saúde', 'Design', 'Finanças', 'Liderança'];

  ngOnInit(): void {
    void this.syncDashboard();

    this.progressTimer = setInterval(() => void this.syncDashboard(), DashboardComponent.PROGRESS_SYNC_MS);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('focus', this.onWindowFocus);

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (this.router.url.split('?')[0] === '/dashboard') {
          void this.syncDashboard();
        }
      });
  }

  ngOnDestroy(): void {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
    }
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('focus', this.onWindowFocus);
  }

  private async syncDashboard(): Promise<void> {
    await this.data.refreshDashboardCourseProgress();
  }

  courseStatusLabel(progress: number): string {
    if (progress >= 100) return 'Concluído';
    if (progress > 0) return 'Em andamento';
    return 'Não iniciado';
  }

  courseStatusClass(progress: number): string {
    if (progress >= 100) return 'bg-emerald-500/20 text-emerald-300';
    if (progress > 0) return 'bg-gold-500/20 text-gold-300';
    return 'bg-slate-500/20 text-slate-400';
  }

  async removeEnrollment(item: { id: number; course?: { title?: string } }): Promise<void> {
    const courseName = item.course?.title ?? 'este curso';
    const confirmed = window.confirm(
      `Deseja remover sua matrícula em "${courseName}"?\n\nVocê perderá o acesso às aulas deste curso. Poderá se matricular novamente pelo catálogo.`,
    );
    if (!confirmed) return;

    this.removingEnrollmentId.set(item.id);
    await this.data.cancelEnrollment(item.id);
    this.removingEnrollmentId.set(null);
  }
}
