import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PortalDataService, Purchase } from '../services/portal-data.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="mx-auto max-w-2xl space-y-6">
      <div class="rounded-xl border border-gold-500/30 bg-obsidian-700/70 p-6">
        <h1 class="text-2xl font-semibold text-gold-300">Editar Perfil</h1>
        <p class="mt-1 text-sm text-slate-300">Atualize seus dados de aluno na Starke Academy.</p>
      </div>

      @if (data.status()) {
        <p class="rounded-lg border border-gold-500/20 bg-obsidian-700/60 px-4 py-2 text-sm text-gold-300">{{ data.status() }}</p>
      }
      @if (data.error()) {
        <p class="rounded-lg border border-red-400/30 bg-red-900/20 px-4 py-2 text-sm text-red-300">{{ data.error() }}</p>
      }

      <form class="space-y-4 rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-6" (ngSubmit)="save()">
        <div class="flex flex-wrap items-center gap-4">
          <div class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gold-500/40 bg-gold-500/10 text-lg font-semibold text-gold-300">
            @if (data.student().avatarUrl) {
              <img [src]="data.student().avatarUrl" alt="Avatar" class="h-full w-full object-cover" />
            } @else {
              {{ initials() }}
            }
          </div>
          <div class="min-w-0 flex-1 space-y-2">
            <div>
              <p class="text-sm text-slate-300">Nível atual</p>
              <p class="text-gold-300">{{ data.student().studentLevel }}</p>
            </div>
            <label class="block text-xs text-slate-400">Foto de perfil</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              (change)="onAvatarSelected($event)"
              [disabled]="avatarUploading()"
              class="w-full max-w-sm rounded-lg border border-gold-500/25 bg-obsidian-800 px-3 py-2 text-xs file:mr-3 file:rounded file:border-0 file:bg-gold-500/20 file:px-3 file:py-1 file:text-xs file:text-gold-300"
            />
            @if (avatarUploading()) {
              <p class="text-xs text-gold-300">Enviando foto...</p>
            }
            <p class="text-xs text-slate-500">PNG, JPG ou WEBP — até 5 MB</p>
          </div>
        </div>

        <input
          [(ngModel)]="form.name"
          name="name"
          required
          placeholder="Nome completo"
          class="w-full rounded-lg border border-gold-500/25 bg-obsidian-800 px-4 py-2 text-sm outline-none focus:border-gold-500/50"
        />
        <input
          [(ngModel)]="form.email"
          name="email"
          type="email"
          required
          placeholder="E-mail"
          class="w-full rounded-lg border border-gold-500/25 bg-obsidian-800 px-4 py-2 text-sm outline-none focus:border-gold-500/50"
        />

        <div class="rounded-lg border border-gold-500/15 bg-obsidian-800/50 p-4">
          <p class="mb-3 text-sm font-medium text-gold-300">Alterar senha (opcional)</p>
          <input
            [(ngModel)]="form.password"
            name="password"
            type="password"
            placeholder="Nova senha"
            class="mb-2 w-full rounded-lg border border-gold-500/25 bg-obsidian-900 px-4 py-2 text-sm outline-none"
          />
        </div>

        <button
          type="submit"
          [disabled]="saving()"
          class="rounded-lg border border-gold-500/40 bg-gold-500/15 px-4 py-2 text-sm font-semibold text-gold-300 hover:bg-gold-500/25 disabled:opacity-60"
        >
          {{ saving() ? 'Salvando...' : 'Salvar perfil' }}
        </button>
      </form>

      <article class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-6">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-lg font-medium text-gold-300">Minhas compras</h2>
            <p class="text-xs text-slate-400">Remova cobranças pendentes que não deseja mais pagar.</p>
          </div>
          <a routerLink="/pagamentos" class="text-xs text-gold-300 underline-offset-2 hover:underline">
            Ver todos os pagamentos
          </a>
        </div>

        @if (data.purchases().length === 0) {
          <p class="text-sm text-slate-500">Nenhuma compra registrada.</p>
        } @else {
          <ul class="space-y-3">
            @for (purchase of data.purchases(); track purchase.id) {
              <li class="rounded-lg border border-gold-500/15 bg-obsidian-800/50 p-3">
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p class="text-sm text-slate-200">
                      #{{ purchase.id }} · {{ courseTitle(purchase.course_id) }}
                    </p>
                    <p class="mt-1 text-xs text-slate-400">
                      {{ formatAmount(purchase) }} · {{ formatPurchaseStatus(purchase.status) }}
                    </p>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    @if (purchase.status === 'paid') {
                      <button
                        type="button"
                        (click)="printReceipt(purchase)"
                        class="rounded border border-gold-500/40 px-2 py-1 text-xs text-gold-300 hover:bg-gold-500/10"
                      >
                        Imprimir comprovante
                      </button>
                    }
                    @if (purchase.status !== 'paid') {
                      <button
                        type="button"
                        (click)="removePurchase(purchase)"
                        [disabled]="removingId() === purchase.id"
                        class="rounded border border-red-400/40 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-60"
                      >
                        {{ removingId() === purchase.id ? 'Removendo...' : 'Remover compra' }}
                      </button>
                    }
                  </div>
                </div>
              </li>
            }
          </ul>
        }
      </article>
    </section>
  `,
})
export class ProfileComponent implements OnInit {
  readonly data = inject(PortalDataService);
  readonly saving = signal(false);
  readonly avatarUploading = signal(false);
  readonly removingId = signal<number | null>(null);

  form = {
    name: '',
    email: '',
    password: '',
  };

  async ngOnInit(): Promise<void> {
    await this.data.refreshPortalData();
    await this.data.refreshPurchases();
    const student = this.data.student();
    this.form = {
      name: student.name,
      email: student.email,
      password: '',
    };
  }

  initials(): string {
    return this.form.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  async onAvatarSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.avatarUploading.set(true);
    try {
      await this.data.uploadAvatar(file);
    } catch {
      // Error handled by PortalDataService.
    } finally {
      this.avatarUploading.set(false);
      input.value = '';
    }
  }

  courseTitle(courseId: number): string {
    return this.data.courses().find((c) => c.id === courseId)?.title ?? `Curso #${courseId}`;
  }

  formatAmount(purchase: Purchase): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: purchase.currency || 'BRL' }).format(
      (purchase.amount_cents || 0) / 100,
    );
  }

  formatPurchaseStatus(status: string): string {
    const labels: Record<string, string> = {
      paid: 'Pago',
      pending: 'Pendente',
      cancelled: 'Cancelado',
      rejected: 'Recusado',
    };
    return labels[status] ?? status;
  }

  printReceipt(purchase: Purchase): void {
    this.data.printPurchaseReceipt(purchase, this.courseTitle(purchase.course_id));
  }

  async removePurchase(purchase: Purchase): Promise<void> {
    const name = this.courseTitle(purchase.course_id);
    const confirmed = window.confirm(
      `Remover a compra #${purchase.id} (${name})?\n\nEsta ação não pode ser desfeita.`,
    );
    if (!confirmed) return;

    this.removingId.set(purchase.id);
    await this.data.deletePurchase(purchase.id);
    this.removingId.set(null);
  }

  async save(): Promise<void> {
    this.saving.set(true);
    try {
      await this.data.updateProfile({
        name: this.form.name,
        email: this.form.email,
        avatarUrl: this.data.student().avatarUrl,
        password: this.form.password || null,
      });
      this.form.password = '';
    } finally {
      this.saving.set(false);
    }
  }
}
