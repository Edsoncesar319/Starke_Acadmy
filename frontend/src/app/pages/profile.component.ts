import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PortalDataService } from '../services/portal-data.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule],
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
          placeholder="Email"
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
    </section>
  `,
})
export class ProfileComponent implements OnInit {
  readonly data = inject(PortalDataService);
  readonly saving = signal(false);
  readonly avatarUploading = signal(false);

  form = {
    name: '',
    email: '',
    password: '',
  };

  async ngOnInit(): Promise<void> {
    await this.data.refreshPortalData();
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
