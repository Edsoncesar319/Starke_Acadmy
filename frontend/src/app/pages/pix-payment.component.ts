import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
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
            <p class="mt-1 text-xs text-slate-400">
              Pague direto pela chave cadastrada da Starke Academy ou escaneie o QR Code da chave.
            </p>
          </div>
          <a routerLink="/catalog" class="btn-outline w-full sm:w-auto"> Voltar ao catálogo </a>
        </div>
      </div>

      @if (data.error()) {
        <p class="rounded-lg border border-red-400/30 bg-red-900/20 px-4 py-2 text-sm text-red-300">{{ data.error() }}</p>
      }

      @if (data.pixCheckout(); as pix) {
        <p class="rounded-lg border border-gold-500/30 bg-gold-500/10 px-4 py-2 text-sm text-slate-200">
          Após pagar o PIX, o <strong class="text-gold-300">administrador</strong> validará o pagamento e liberará suas
          aulas. Você receberá o comprovante na Central de Ajuda quando a matrícula for confirmada.
        </p>

        <div class="rounded-xl border border-gold-500/30 bg-obsidian-700/60 p-5">
          <p class="text-xs uppercase tracking-wider text-gold-300">Valor a pagar</p>
          <p class="mt-1 text-3xl font-semibold text-slate-100">{{ formatAmount(pix.amount_brl, coursePrice()) }}</p>
          <p class="mt-2 text-xs text-slate-400">
            Compra #{{ pix.purchase.id }} · {{ courseTitle(pix.purchase.course_id) }}
          </p>
        </div>

        @if (pix.pix_key) {
          <div class="rounded-xl border border-emerald-500/30 bg-emerald-900/10 p-5">
            <h2 class="text-sm font-medium text-emerald-300">Chave PIX (pagamento direto)</h2>
            <p class="mt-1 text-xs text-slate-400">
              Copie a chave abaixo, cole no app do seu banco e informe o valor exato de
              {{ formatAmount(pix.amount_brl, coursePrice()) }}.
            </p>
            <div class="mt-3 rounded-lg border border-gold-500/20 bg-obsidian-900/80 px-4 py-3">
              <p class="break-all font-mono text-sm text-slate-100">{{ pix.pix_key }}</p>
            </div>
            <div class="mt-3 flex flex-col gap-2 sm:flex-row">
              <button type="button" (click)="copyPix(pix.pix_key!)" class="btn-primary w-full sm:w-auto">
                Copiar chave PIX
              </button>
              @if (pix.merchant_name) {
                <span class="self-center text-xs text-slate-400">Recebedor: {{ pix.merchant_name }}</span>
              }
            </div>
          </div>
        }

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-5">
            <h2 class="text-sm font-medium text-gold-300">QR Code da chave</h2>
            <p class="mt-1 text-xs text-slate-400">Escaneie para pagar direto na chave cadastrada.</p>
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
            <p class="mt-1 text-xs text-slate-400">Alternativa para apps que aceitam o código da chave PIX.</p>
            <textarea readonly class="form-textarea mt-3 text-sm sm:text-base">{{ pix.qr_code }}</textarea>
            <div class="mt-3">
              <button type="button" (click)="copyPix(pix.qr_code)" class="btn-outline w-full">Copiar código PIX</button>
            </div>
          </div>
        </div>

        @if (pix.purchase.status !== 'paid') {
          <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <p class="w-full rounded-lg border border-gold-500/20 bg-obsidian-800/60 px-4 py-3 text-sm text-slate-300">
              @if (pix.purchase.status === 'approved') {
                Pagamento recebido. Aguardando liberação pelo administrador.
              } @else {
                {{
                  polling()
                    ? 'Aguardando validação do pagamento...'
                    : 'Após pagar pela chave PIX, aguarde a confirmação do administrador.'
                }}
              }
            </p>
            <a routerLink="/pagamentos" class="btn-outline w-full text-center sm:w-auto"> Ver meus pagamentos </a>
          </div>
        } @else {
          <div class="space-y-3">
            <p class="rounded-lg border border-emerald-500/30 bg-emerald-900/20 px-4 py-2 text-sm text-emerald-300">
              Pagamento confirmado. Seu comprovante está na Central de Ajuda e o curso já está liberado.
            </p>
            <a routerLink="/support" [queryParams]="{ chat: '1' }" class="btn-outline w-full text-center sm:w-auto">
              Abrir Central de Ajuda
            </a>
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
  readonly polling = signal(false);

  readonly coursePrice = computed(() => {
    const checkout = this.data.pixCheckout();
    if (!checkout) return 0;
    return this.data.courses().find((c) => c.id === checkout.purchase.course_id)?.price ?? 0;
  });

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

  courseTitle(courseId: number): string {
    return this.data.courses().find((c) => c.id === courseId)?.title ?? `Curso #${courseId}`;
  }

  formatAmount(amountBrl: number | null | undefined, fallbackPrice: number): string {
    const value = amountBrl ?? fallbackPrice ?? 0;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  printReceipt(): void {
    const checkout = this.data.pixCheckout();
    if (!checkout || checkout.purchase.status !== 'paid') return;
    const courseTitle = this.courseTitle(checkout.purchase.course_id);
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
      this.data.pixStatus.set('Copiado para a área de transferência.');
    } catch {
      this.data.pixStatus.set('Não foi possível copiar automaticamente. Selecione e copie manualmente.');
    }
  }
}
