import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { PortalDataService } from '../services/portal-data.service';

@Component({
  selector: 'app-pix-payment',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="mx-auto max-w-3xl space-y-4">
      <div class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 class="text-xl font-semibold text-gold-300">Pagamento via PIX</h1>
            <p class="mt-1 text-xs text-slate-400">Escaneie o QR Code ou copie e cole no app do seu banco.</p>
          </div>
          <a
            routerLink="/catalog"
            class="rounded border border-gold-500/30 px-3 py-2 text-xs text-slate-200 hover:bg-gold-500/10"
          >
            Voltar ao catálogo
          </a>
        </div>
      </div>

      @if (data.error()) {
        <p class="rounded-lg border border-red-400/30 bg-red-900/20 px-4 py-2 text-sm text-red-300">{{ data.error() }}</p>
      }

      @if (data.pixCheckout(); as pix) {
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-5">
            <h2 class="text-sm font-medium text-gold-300">QR Code</h2>
            <div class="mt-3 flex justify-center">
              <img
                [src]="'data:image/jpeg;base64,' + pix.qr_code_base64"
                alt="QR Code PIX"
                class="h-56 w-56 rounded bg-white p-2"
              />
            </div>
          </div>

          <div class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-5">
            <h2 class="text-sm font-medium text-gold-300">PIX copia e cola</h2>
            <textarea
              readonly
              class="mt-3 h-40 w-full rounded border border-gold-500/20 bg-obsidian-900 px-3 py-2 text-[11px] text-slate-200"
            >{{ pix.qr_code }}</textarea>
            <div class="mt-3 flex gap-2">
              <button
                type="button"
                (click)="copyPix(pix.qr_code)"
                class="flex-1 rounded border border-gold-500/40 px-3 py-2 text-xs text-gold-300 hover:bg-gold-500/10"
              >
                Copiar
              </button>
              @if (pix.ticket_url) {
                <a
                  class="flex-1 rounded border border-gold-500/40 px-3 py-2 text-center text-xs text-gold-300 hover:bg-gold-500/10"
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

  async ngOnInit(): Promise<void> {
    this.data.pixModalOpen.set(true);
    const courseId = Number(this.route.snapshot.paramMap.get('courseId') ?? 0);
    if (!courseId) {
      this.data.error.set('Curso inválido para pagamento.');
      await this.router.navigateByUrl('/catalog');
      return;
    }

    // Se não houver checkout gerado (ex: acesso direto na URL), gera aqui.
    if (!this.data.pixCheckout()) {
      await this.data.startPixCheckout(courseId);
      return;
    }

    // Garante polling ativo.
    void this.data.pollPixStatus(this.data.pixCheckout()!.purchase.id);
  }

  ngOnDestroy(): void {
    this.data.pixModalOpen.set(false);
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

