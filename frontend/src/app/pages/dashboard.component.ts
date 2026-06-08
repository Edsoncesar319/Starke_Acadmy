import { NgClass } from '@angular/common';
import { Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { PortalDataService } from '../services/portal-data.service';
import { findPurchaseIdFromReceiptSubject, isReceiptMessage } from '../utils/payment-receipt.util';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NgClass, FormsModule],
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

      <section class="chat-panel">
        <header class="chat-header">
          <div>
            <p class="text-sm font-semibold text-gold-300">Chat com a Academia</p>
            <p class="text-xs text-slate-400">Converse com a equipe Starke Academy</p>
          </div>
          @if (data.unreadMessagesCount() > 0) {
            <span class="rounded-full bg-gold-500 px-2 py-0.5 text-xs font-semibold text-obsidian-900">
              {{ data.unreadMessagesCount() }} nova(s)
            </span>
          }
        </header>

        <div class="chat-body">
          @if (chatMessages().length === 0) {
            <p class="text-center text-sm text-slate-500">
              Nenhuma mensagem ainda. Envie sua primeira mensagem para a Starke Academy abaixo.
            </p>
          } @else {
            @for (message of chatMessages(); track message.id) {
              @if (message.isFromStudent) {
                <div class="chat-row chat-row-out">
                  <div>
                    <article class="chat-bubble chat-bubble-out">
                      <p class="font-semibold text-gold-200">{{ message.subject }}</p>
                      @if (courseTitle(message.courseId)) {
                        <p class="mt-1 text-xs text-gold-200/70">{{ courseTitle(message.courseId) }}</p>
                      }
                      <p class="mt-2 whitespace-pre-wrap leading-relaxed">{{ message.details }}</p>
                    </article>
                    <p class="chat-meta text-right">{{ formatTime(message.createdAt) }}</p>
                  </div>
                  <div class="chat-avatar">EU</div>
                </div>
              } @else {
                <div class="chat-row chat-row-in">
                  <div class="chat-avatar">SA</div>
                  <div>
                    <article class="chat-bubble chat-bubble-in">
                      <p class="font-semibold text-gold-300">{{ message.subject }}</p>
                      @if (courseTitle(message.courseId)) {
                        <p class="mt-1 text-xs text-gold-400/80">{{ courseTitle(message.courseId) }}</p>
                      }
                      <p class="mt-2 whitespace-pre-wrap leading-relaxed">{{ message.details }}</p>
                      @if (isReceiptMessage(message.subject)) {
                        <button
                          type="button"
                          (click)="printReceiptFromMessage(message)"
                          class="btn-outline mt-3 text-xs"
                        >
                          Imprimir comprovante
                        </button>
                      }
                    </article>
                    <p class="chat-meta">{{ formatTime(message.createdAt) }}</p>
                  </div>
                </div>
              }
            }
          }
        </div>

        <form class="chat-composer space-y-2" (ngSubmit)="sendChatMessage()">
          <select
            [(ngModel)]="chatCourseId"
            name="chatCourseId"
            class="chat-input"
          >
            <option [ngValue]="null">Assunto geral (sem curso)</option>
            @for (item of data.activeCourses(); track item.courseId) {
              <option [ngValue]="item.courseId">{{ item.course?.title }}</option>
            }
          </select>
          <input
            [(ngModel)]="chatSubject"
            name="chatSubject"
            placeholder="Assunto (opcional)"
            class="chat-input"
          />
          <textarea
            [(ngModel)]="chatDetails"
            name="chatDetails"
            required
            rows="3"
            placeholder="Escreva sua mensagem para a Starke Academy..."
            class="chat-input"
          ></textarea>
          <div class="flex justify-end">
            <button type="submit" [disabled]="chatSending()" class="chat-send-btn">
              {{ chatSending() ? 'Enviando...' : 'Enviar mensagem' }}
            </button>
          </div>
        </form>
      </section>

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
  readonly chatSending = signal(false);
  chatSubject = '';
  chatDetails = '';
  chatCourseId: number | null = null;
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
  readonly chatMessages = computed(() =>
    [...this.data.messages()].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    ),
  );
  readonly niches = ['Tecnologia', 'Negócios', 'Saúde', 'Design', 'Finanças', 'Liderança'];
  readonly isReceiptMessage = isReceiptMessage;

  ngOnInit(): void {
    this.data.markMessagesAsSeen();
    void this.data.refreshPurchases();
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
    await Promise.all([this.data.refreshDashboardCourseProgress(), this.data.refreshMessages()]);
  }

  async sendChatMessage(): Promise<void> {
    const details = this.chatDetails.trim();
    if (!details) {
      this.data.error.set('Digite uma mensagem antes de enviar.');
      return;
    }

    this.chatSending.set(true);
    const sent = await this.data.sendStudentMessage({
      details,
      subject: this.chatSubject.trim() || undefined,
      courseId: this.chatCourseId,
    });
    this.chatSending.set(false);

    if (!sent) return;

    this.chatDetails = '';
    this.chatSubject = '';
    this.data.status.set('Mensagem enviada para a Starke Academy.');
    await this.data.refreshMessages();
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

  printReceiptFromMessage(message: { subject: string; courseId: number | null }): void {
    const purchaseId = findPurchaseIdFromReceiptSubject(message.subject);
    if (!purchaseId) {
      this.data.error.set('Não foi possível identificar a compra deste comprovante.');
      return;
    }
    const purchase = this.data.purchases().find((p) => p.id === purchaseId);
    if (!purchase || purchase.status !== 'paid') {
      this.data.error.set('Comprovante indisponível para impressão. Atualize a página de pagamentos.');
      void this.data.refreshPurchases().then(() => {
        const refreshed = this.data.purchases().find((p) => p.id === purchaseId);
        if (refreshed?.status === 'paid') {
          this.data.printPurchaseReceipt(refreshed, this.courseTitle(refreshed.course_id));
        }
      });
      return;
    }
    this.data.printPurchaseReceipt(purchase, this.courseTitle(purchase.course_id));
  }

  courseTitle(courseId: number | null): string {
    if (!courseId) return '';
    return this.data.courses().find((course) => course.id === courseId)?.title ?? '';
  }

  formatTime(value: string): string {
    return new Date(value).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
