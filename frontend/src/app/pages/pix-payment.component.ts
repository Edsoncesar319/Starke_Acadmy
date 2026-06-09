import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { PortalDataService } from '../services/portal-data.service';

@Component({
  selector: 'app-pix-payment',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="page-section mx-auto max-w-3xl">
      <div class="panel">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 class="text-xl font-semibold text-gold-300">Pagamento via PIX</h1>
            <p class="mt-1 text-xs text-slate-400">Escaneie o QR Code ou copie e cole no app do seu banco.</p>
          </div>
          <a routerLink="/catalog" class="btn-outline w-full sm:w-auto"> Voltar ao catálogo </a>
        </div>
      </div>

      @if (data.error()) {
        <p class="rounded-lg border border-red-400/30 bg-red-900/20 px-4 py-2 text-sm text-red-300">{{ data.error() }}</p>
      }

      @if (data.pixCheckout(); as pix) {
        @if (pix.provider === 'mercadopago') {
          <p class="rounded-lg border border-gold-500/30 bg-gold-500/10 px-4 py-2 text-sm text-slate-200">
            Após pagar, a confirmação é <strong class="text-gold-300">automática</strong>. O curso será liberado assim
            que o Mercado Pago notificar o sistema — geralmente em poucos segundos.
          </p>
        } @else {
          <p class="rounded-lg border border-gold-500/30 bg-gold-500/10 px-4 py-2 text-sm text-slate-200">
            Após pagar, clique em <strong class="text-gold-300">Confirmar pagamento</strong>. O status será atualizado
            para pago, você receberá o comprovante no chat do painel e o curso será liberado.
          </p>
        }

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-5">
            <h2 class="text-sm font-medium text-gold-300">QR Code</h2>
            <div class="mt-3 flex justify-center">
              <img
                [src]="'data:image/png;base64,' + pix.qr_code_base64"
                alt="QR Code PIX"
                class="h-48 w-48 max-w-full rounded bg-white p-2 sm:h-56 sm:w-56"
              />
            </div>
          </div>

          <div class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-5">
            <h2 class="text-sm font-medium text-gold-300">PIX copia e cola</h2>
            <textarea readonly class="form-textarea mt-3 text-sm sm:text-base">{{ pix.qr_code }}</textarea>
            <div class="mt-3 flex flex-col gap-2 sm:flex-row">
              <button type="button" (click)="copyPix(pix.qr_code)" class="btn-outline w-full flex-1">Copiar</button>
              @if (pix.ticket_url) {
                <a
                  class="btn-outline w-full flex-1 text-center"
                  [href]="pix.ticket_url"
                  target="_blank"
                  rel="noopener"
                >
                  Abrir
                </a>
              }
            </div>
          </div>
        </div>

        @if (pix.purchase.status !== 'paid') {
          <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            @if (pix.provider !== 'mercadopago') {
              <button
                type="button"
                (click)="confirmPayment()"
                [disabled]="confirming()"
                class="btn-success w-full sm:w-auto"
              >
                {{ confirming() ? 'Confirmando...' : 'Confirmar pagamento' }}
              </button>
            } @else {
              <p class="w-full rounded-lg border border-gold-500/20 bg-obsidian-800/60 px-4 py-3 text-sm text-slate-300">
                {{ polling() ? 'Aguardando confirmação do PIX...' : 'Verificando status do pagamento...' }}
              </p>
            }
            <a routerLink="/dashboard" class="btn-outline w-full text-center sm:w-auto"> Ver comprovante no painel </a>
          </div>
        } @else {
          <div class="space-y-3">
            <p class="rounded-lg border border-emerald-500/30 bg-emerald-900/20 px-4 py-2 text-sm text-emerald-300">
              Pagamento confirmado. Seu comprovante está no chat do painel e o curso já está liberado.
            </p>
            <button
              type="button"
              (click)="printReceipt()"
              class="rounded-lg border border-gold-500/40 px-4 py-2 text-sm text-gold-300 hover:bg-gold-500/10"
            >
              Imprimir comprovante
            </button>
          </div>
        }
      } @else {
        <div class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-8 text-center text-slate-400">
          Gerando cobrança PIX...
        </div>
      }

      @if (data.pixStatus()) {
        <p class="rounded-lg border border-gold-500/15 bg-obsidian-900/40 px-4 py-3 text-xs text-slate-200">
          {{ data.pixStatus() }}
        </p>
      }
    </section>
  `,
})
export class PixPaymentComponent implements OnInit, OnDestroy {
  readonly data = inject(PortalDataService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly confirming = signal(false);
  readonly polling = signal(false);

  async ngOnInit(): Promise<void> {
    this.data.pixModalOpen.set(true);
    const courseId = Number(this.route.snapshot.paramMap.get('courseId') ?? 0);
    if (!courseId) {
      this.data.error.set('Curso inválido para pagamento.');
      await this.router.navigateByUrl('/catalog');
      return;
    }

    if (!this.data.pixCheckout()) {
      await this.data.startPixCheckout(courseId);
    }

    const checkout = this.data.pixCheckout();
    if (!checkout) {
      return;
    }

    if (checkout.purchase.status === 'paid') {
      return;
    }

    this.polling.set(true);
    void this.data.pollPixStatus(checkout.purchase.id).finally(() => this.polling.set(false));
  }

  ngOnDestroy(): void {
    this.data.pixModalOpen.set(false);
  }

  async confirmPayment(): Promise<void> {
    const checkout = this.data.pixCheckout();
    if (!checkout || checkout.purchase.status === 'paid' || checkout.provider === 'mercadopago') {
      return;
    }

    this.confirming.set(true);
    const ok = await this.data.confirmPayment(checkout.purchase.id);
    this.confirming.set(false);

    if (ok) {
      await this.router.navigateByUrl('/dashboard');
    }
  }

  printReceipt(): void {
    const checkout = this.data.pixCheckout();
    if (!checkout || checkout.purchase.status !== 'paid') return;
    const courseTitle =
      this.data.courses().find((c) => c.id === checkout.purchase.course_id)?.title ??
      `Curso #${checkout.purchase.course_id}`;
    const purchase = this.data.purchases().find((p) => p.id === checkout.purchase.id);
    if (purchase) {
      this.data.printPurchaseReceipt(purchase, courseTitle);
      return;
    }
    const course = this.data.courses().find((c) => c.id === checkout.purchase.course_id);
    this.data.printPurchaseReceipt(
      {
        id: checkout.purchase.id,
        user_id: 0,
        course_id: checkout.purchase.course_id,
        amount_cents: Math.round((course?.price ?? 0) * 100),
        currency: 'BRL',
        status: 'paid',
        provider: checkout.provider,
        provider_reference: checkout.provider_reference,
        created_at: new Date().toISOString(),
        paid_at: new Date().toISOString(),
      },
      courseTitle,
    );
  }

  async copyPix(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.data.pixStatus.set('Código PIX copiado.');
    } catch {
      this.data.pixStatus.set('Não foi possível copiar automaticamente. Selecione e copie manualmente.');
    }
  }
}
