import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PortalDataService } from '../services/portal-data.service';

@Component({
  selector: 'app-my-payments',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="page-section">
      <div class="panel">
        <h1 class="text-lg font-semibold text-gold-300">Meus pagamentos</h1>
        <p class="mt-1 text-xs text-slate-400">Acompanhe cobranças pendentes e pagamentos aprovados.</p>
      </div>

      @if (data.status()) {
        <p class="rounded-lg border border-gold-500/20 bg-obsidian-700/60 px-4 py-2 text-sm text-gold-300">{{ data.status() }}</p>
      }
      @if (data.error()) {
        <p class="rounded-lg border border-red-400/30 bg-red-900/20 px-4 py-2 text-sm text-red-300">{{ data.error() }}</p>
      }

      @if (data.purchases().length === 0) {
        <div class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-8 text-center text-slate-400">
          Nenhum pagamento encontrado.
        </div>
      } @else {
        <div class="space-y-3">
          @for (purchase of data.purchases(); track purchase.id) {
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
                <span
                  class="rounded-full border px-2 py-1 text-xs"
                  [class]="
                    purchase.status === 'paid'
                      ? 'border-emerald-500/40 text-emerald-300'
                      : purchase.status === 'pending'
                        ? 'border-gold-500/40 text-gold-300'
                        : 'border-slate-500/40 text-slate-300'
                  "
                >
                  {{ formatStatus(purchase.status) }}
                </span>
              </div>

              <div class="mt-3 flex flex-wrap gap-2">
                @if (purchase.status === 'pending') {
                  <button
                    type="button"
                    (click)="payWithPix(purchase.course_id)"
                    class="rounded border border-gold-500/40 px-3 py-2 text-xs text-gold-300 hover:bg-gold-500/10"
                  >
                    Pagar com PIX
                  </button>
                  <button
                    type="button"
                    (click)="confirmPayment(purchase.id)"
                    [disabled]="confirmingId() === purchase.id"
                    class="rounded border border-emerald-500/40 px-3 py-2 text-xs text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-60"
                  >
                    {{ confirmingId() === purchase.id ? 'Confirmando...' : 'Confirmar pagamento' }}
                  </button>
                }
                @if (purchase.status === 'paid') {
                  <button
                    type="button"
                    (click)="printReceipt(purchase)"
                    class="rounded border border-gold-500/40 px-3 py-2 text-xs text-gold-300 hover:bg-gold-500/10"
                  >
                    Imprimir comprovante
                  </button>
                  <a
                    routerLink="/lesson-player"
                    class="rounded border border-emerald-500/40 px-3 py-2 text-xs text-emerald-300 hover:bg-emerald-500/10"
                  >
                    Acessar aulas
                  </a>
                }
                @if (purchase.status !== 'paid') {
                  <button
                    type="button"
                    (click)="removePurchase(purchase)"
                    [disabled]="removingId() === purchase.id"
                    class="rounded border border-red-400/40 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-60"
                  >
                    {{ removingId() === purchase.id ? 'Removendo...' : 'Remover compra' }}
                  </button>
                }
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
  readonly confirmingId = signal<number | null>(null);
  readonly removingId = signal<number | null>(null);

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

  async confirmPayment(purchaseId: number): Promise<void> {
    this.confirmingId.set(purchaseId);
    const ok = await this.data.confirmPayment(purchaseId);
    this.confirmingId.set(null);
    if (ok) {
      await this.router.navigateByUrl('/dashboard');
    }
  }

  async payWithPix(courseId: number): Promise<void> {
    await this.data.startPixCheckout(courseId);
    if (this.data.pixCheckout()) {
      // Reusa a tela dedicada PIX já existente
      await this.router.navigateByUrl(`/pagamento/${courseId}`);
    }
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
      cancelled: 'Cancelado',
      rejected: 'Recusado',
      approved: 'Aprovado',
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

