import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PortalDataService } from '../services/portal-data.service';

@Component({
  selector: 'app-my-payments',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="space-y-4">
      <div class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-5">
        <h1 class="text-lg font-semibold text-gold-300">Meus pagamentos</h1>
        <p class="mt-1 text-xs text-slate-400">Acompanhe cobranças pendentes e pagamentos aprovados.</p>
      </div>

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
                  <p class="text-sm text-slate-200">Compra #{{ purchase.id }} · Curso {{ purchase.course_id }}</p>
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
                  {{ purchase.status.toUpperCase() }}
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
                }
                @if (purchase.status === 'paid') {
                  <a
                    routerLink="/lesson-player"
                    class="rounded border border-emerald-500/40 px-3 py-2 text-xs text-emerald-300 hover:bg-emerald-500/10"
                  >
                    Acessar aulas
                  </a>
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

  async ngOnInit(): Promise<void> {
    await this.data.refreshPurchases();
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

