import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PortalDataService, Purchase } from '../services/portal-data.service';

@Component({
  selector: 'app-my-payments',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="page-section">
      <div class="panel">
        <h1 class="text-lg font-semibold text-gold-300">Meus pagamentos</h1>
        <p class="mt-1 text-xs text-slate-400">
          Acompanhe cobranças pendentes. As aulas são liberadas após confirmação do administrador.
        </p>
      </div>

      @if (data.status()) {
        <p class="rounded-lg border border-gold-500/20 bg-obsidian-700/60 px-4 py-2 text-sm text-gold-300">{{ data.status() }}</p>
      }
      @if (data.error()) {
        <p class="rounded-lg border border-red-400/30 bg-red-900/20 px-4 py-2 text-sm text-red-300">{{ data.error() }}</p>
      }

      @if (pendingPurchases().length > 0) {
        <div class="space-y-3">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-gold-300">Pagamentos pendentes</h2>
          @for (purchase of pendingPurchases(); track purchase.id) {
            <article class="rounded-xl border border-gold-500/30 bg-obsidian-700/60 p-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p class="text-sm text-slate-200">
                    Compra #{{ purchase.id }} · {{ courseTitle(purchase.course_id) }}
                  </p>
                  <p class="mt-1 text-xs text-slate-400">
                    {{ formatAmount(purchase.amount_cents, purchase.currency) }} · {{ formatDate(purchase.created_at) }}
                  </p>
                </div>
                <span class="rounded-full border border-gold-500/40 px-2 py-1 text-xs text-gold-300">
                  {{ formatStatus(purchase.status) }}
                </span>
              </div>

              <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  (click)="payWithPix(purchase)"
                  [disabled]="payingCourseId() === purchase.course_id"
                  class="btn-primary w-full sm:w-auto"
                >
                  {{ payingCourseId() === purchase.course_id ? 'Gerando PIX...' : 'Pagar com PIX' }}
                </button>
                @if (data.isPurchaseAwaitingAdminRelease(purchase)) {
                  <p class="w-full rounded-lg border border-gold-500/20 bg-obsidian-800/60 px-3 py-2 text-xs text-slate-300 sm:w-auto">
                    Pagamento recebido — aguardando liberação pelo administrador.
                  </p>
                } @else if (data.isPurchaseAwaitingPayment(purchase)) {
                  <p class="w-full rounded-lg border border-gold-500/20 bg-obsidian-800/60 px-3 py-2 text-xs text-slate-300 sm:w-auto">
                    Após pagar, aguarde a confirmação do administrador para acessar as aulas.
                  </p>
                }
                <button
                  type="button"
                  (click)="removePurchase(purchase)"
                  [disabled]="removingId() === purchase.id"
                  class="rounded border border-red-400/40 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-60"
                >
                  {{ removingId() === purchase.id ? 'Removendo...' : 'Remover compra' }}
                </button>
              </div>
            </article>
          }
        </div>
      }

      @if (data.coursesAwaitingPayment().length > 0) {
        <div class="space-y-3">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-gold-300">Cursos aguardando pagamento</h2>
          @for (course of data.coursesAwaitingPayment(); track course.id) {
            <article class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p class="text-sm font-medium text-slate-200">{{ course.title }}</p>
                  <p class="mt-1 text-xs text-slate-400">{{ course.category }}</p>
                </div>
                <span class="text-base font-medium text-gold-300">{{ formatPrice(course.price) }}</span>
              </div>
              <div class="mt-3">
                <button
                  type="button"
                  (click)="payWithPixForCourse(course.id)"
                  [disabled]="payingCourseId() === course.id"
                  class="btn-primary w-full sm:w-auto"
                >
                  {{ payingCourseId() === course.id ? 'Gerando PIX...' : 'Pagar com PIX' }}
                </button>
              </div>
            </article>
          }
        </div>
      }

      @if (paidPurchases().length > 0) {
        <div class="space-y-3">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-gold-300">Pagamentos concluídos</h2>
          @for (purchase of paidPurchases(); track purchase.id) {
            <article class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p class="text-sm text-slate-200">
                    Compra #{{ purchase.id }} · {{ courseTitle(purchase.course_id) }}
                  </p>
                  <p class="mt-1 text-xs text-slate-400">
                    {{ formatAmount(purchase.amount_cents, purchase.currency) }} · {{ formatDate(purchase.created_at) }}
                  </p>
                </div>
                <span class="rounded-full border border-emerald-500/40 px-2 py-1 text-xs text-emerald-300">
                  Pago
                </span>
              </div>

              <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button type="button" (click)="printReceipt(purchase)" class="btn-outline w-full sm:w-auto">
                  Imprimir comprovante
                </button>
                <a
                  routerLink="/lesson-player"
                  class="rounded border border-emerald-500/40 px-3 py-2 text-center text-xs text-emerald-300 hover:bg-emerald-500/10"
                >
                  Acessar aulas
                </a>
              </div>
            </article>
          }
        </div>
      }

      @if (
        pendingPurchases().length === 0 &&
        data.coursesAwaitingPayment().length === 0 &&
        paidPurchases().length === 0 &&
        otherPurchases().length === 0
      ) {
        <div class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-8 text-center text-slate-400">
          Nenhum pagamento encontrado. Explore o catálogo para matricular-se em um curso pago.
        </div>
      }

      @if (otherPurchases().length > 0) {
        <div class="space-y-3">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-400">Outros registros</h2>
          @for (purchase of otherPurchases(); track purchase.id) {
            <article class="rounded-xl border border-slate-500/20 bg-obsidian-700/60 p-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p class="text-sm text-slate-200">
                    Compra #{{ purchase.id }} · {{ courseTitle(purchase.course_id) }}
                  </p>
                  <p class="mt-1 text-xs text-slate-400">
                    {{ formatAmount(purchase.amount_cents, purchase.currency) }} · {{ formatDate(purchase.created_at) }}
                  </p>
                </div>
                <span class="rounded-full border border-slate-500/40 px-2 py-1 text-xs text-slate-300">
                  {{ formatStatus(purchase.status) }}
                </span>
              </div>
              <div class="mt-3">
                <button
                  type="button"
                  (click)="removePurchase(purchase)"
                  [disabled]="removingId() === purchase.id"
                  class="rounded border border-red-400/40 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-60"
                >
                  {{ removingId() === purchase.id ? 'Removendo...' : 'Remover compra' }}
                </button>
              </div>
            </article>
          }
        </div>
      }
    </section>
  `,
})
export class MyPaymentsComponent implements OnInit {
  readonly data = inject(PortalDataService);
  private readonly router = inject(Router);
  readonly removingId = signal<number | null>(null);
  readonly payingCourseId = signal<number | null>(null);

  readonly pendingPurchases = computed(() =>
    this.data.purchases().filter((purchase) => this.data.isPurchaseAwaitingPayment(purchase)),
  );

  readonly paidPurchases = computed(() => this.data.purchases().filter((purchase) => purchase.status === 'paid'));

  readonly otherPurchases = computed(() =>
    this.data.purchases().filter(
      (purchase) => !this.data.isPurchaseAwaitingPayment(purchase) && purchase.status !== 'paid',
    ),
  );

  async ngOnInit(): Promise<void> {
    await this.data.refreshPortalData();
    await this.data.refreshPurchases();
  }

  courseTitle(courseId: number): string {
    return this.data.courses().find((c) => c.id === courseId)?.title ?? `Curso #${courseId}`;
  }

  printReceipt(purchase: { id: number; course_id: number; status: string }): void {
    const full = this.data.purchases().find((p) => p.id === purchase.id);
    if (!full) return;
    this.data.printPurchaseReceipt(full, this.courseTitle(purchase.course_id));
  }

  async removePurchase(purchase: { id: number; course_id: number; status: string }): Promise<void> {
    const name = this.courseTitle(purchase.course_id);
    const confirmed = window.confirm(
      `Remover a compra #${purchase.id} (${name})?\n\nEsta ação não pode ser desfeita.`,
    );
    if (!confirmed) return;

    this.removingId.set(purchase.id);
    await this.data.deletePurchase(purchase.id);
    this.removingId.set(null);
  }

  async payWithPix(purchase: Purchase): Promise<void> {
    await this.openPixCheckout(purchase.course_id);
  }

  async payWithPixForCourse(courseId: number): Promise<void> {
    await this.openPixCheckout(courseId);
  }

  private async openPixCheckout(courseId: number, purchaseId?: number): Promise<void> {
    this.payingCourseId.set(courseId);
    const ok = await this.data.startPixCheckout(courseId);
    this.payingCourseId.set(null);
    if (ok && this.data.pixCheckout()) {
      await this.router.navigateByUrl(`/pagamento/${courseId}`);
    }
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price || 0);
  }

  formatAmount(amountCents: number, currency: string): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency || 'BRL' }).format(
      (amountCents || 0) / 100,
    );
  }

  formatStatus(status: string): string {
    const labels: Record<string, string> = {
      paid: 'Pago',
      pending: 'Pendente',
      in_process: 'Processando',
      in_mediation: 'Em análise',
      cancelled: 'Cancelado',
      rejected: 'Recusado',
      approved: 'Aguardando liberação',
    };
    return labels[status] ?? status;
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
