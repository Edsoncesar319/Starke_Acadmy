import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { AdminCourse, AdminService } from '../services/admin.service';

@Component({
  selector: 'app-super-admin-dashboard',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="space-y-6 p-6">
      <header class="rounded-xl border border-gold-500/30 bg-obsidian-700/70 p-6">
        <h1 class="text-2xl font-semibold text-gold-300">Super Admin Dashboard</h1>
        <p class="mt-1 text-sm text-slate-300">Edição dos cursos oferecidos e envio de detalhes para alunos.</p>
        <button (click)="logout()" class="mt-4 rounded-lg border border-gold-500/40 px-3 py-2 text-xs font-semibold text-gold-300 hover:bg-gold-500/10">
          Logout
        </button>
      </header>

      @if (admin.status()) {
        <p class="rounded-lg border border-gold-500/20 bg-obsidian-700/60 px-4 py-2 text-sm text-gold-300">{{ admin.status() }}</p>
      }
      @if (admin.error()) {
        <p class="rounded-lg border border-red-400/30 bg-red-900/20 px-4 py-2 text-sm text-red-300">{{ admin.error() }}</p>
      }

      <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <article class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-4">
          <h2 class="mb-4 text-lg font-medium text-gold-300">Inserir Novo Curso</h2>
          <form class="mb-6 space-y-2 rounded-lg border border-gold-500/20 p-3" (ngSubmit)="createNewCourse()">
            <input [(ngModel)]="newCourse.title" name="new-title" required placeholder="Titulo do curso" class="w-full rounded border border-gold-500/20 bg-obsidian-800 px-3 py-2 text-sm" />
            <textarea [(ngModel)]="newCourse.description" name="new-description" required placeholder="Descricao" class="w-full rounded border border-gold-500/20 bg-obsidian-800 px-3 py-2 text-sm"></textarea>
            <div class="grid grid-cols-3 gap-2">
              <input [(ngModel)]="newCourse.category" name="new-category" required placeholder="Categoria" class="rounded border border-gold-500/20 bg-obsidian-800 px-2 py-2 text-sm" />
              <input [(ngModel)]="newCourse.price" name="new-price" required type="number" min="0" class="rounded border border-gold-500/20 bg-obsidian-800 px-2 py-2 text-sm" />
              <input [(ngModel)]="newCourse.rating" name="new-rating" required type="number" min="0" max="5" step="0.1" class="rounded border border-gold-500/20 bg-obsidian-800 px-2 py-2 text-sm" />
            </div>
            <input [(ngModel)]="newCourse.hero_image_url" name="new-hero" placeholder="URL da imagem (opcional)" class="w-full rounded border border-gold-500/20 bg-obsidian-800 px-3 py-2 text-sm" />
            <button type="submit" class="rounded border border-gold-500/40 px-3 py-2 text-xs text-gold-300 hover:bg-gold-500/10">Inserir novo curso</button>
          </form>

          <h2 class="mb-4 text-lg font-medium text-gold-300">Editar Cursos Oferecidos</h2>
          <div class="space-y-4">
            @for (course of admin.courses(); track course.id) {
              <form (ngSubmit)="saveCourse(course)" class="space-y-2 rounded-lg border border-gold-500/20 p-3">
                <input [(ngModel)]="course.title" [name]="'title-' + course.id" class="w-full rounded border border-gold-500/20 bg-obsidian-800 px-3 py-2 text-sm" />
                <textarea [(ngModel)]="course.description" [name]="'description-' + course.id" class="w-full rounded border border-gold-500/20 bg-obsidian-800 px-3 py-2 text-sm"></textarea>
                <div class="grid grid-cols-3 gap-2">
                  <input [(ngModel)]="course.category" [name]="'category-' + course.id" class="rounded border border-gold-500/20 bg-obsidian-800 px-2 py-2 text-sm" />
                  <input [(ngModel)]="course.price" [name]="'price-' + course.id" type="number" class="rounded border border-gold-500/20 bg-obsidian-800 px-2 py-2 text-sm" />
                  <input [(ngModel)]="course.rating" [name]="'rating-' + course.id" type="number" step="0.1" class="rounded border border-gold-500/20 bg-obsidian-800 px-2 py-2 text-sm" />
                </div>
                <input [(ngModel)]="course.hero_image_url" [name]="'hero-' + course.id" class="w-full rounded border border-gold-500/20 bg-obsidian-800 px-3 py-2 text-sm" />
                <div class="space-y-2">
                  <label class="block text-xs text-slate-300">Upload nova imagem do curso</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    [name]="'upload-' + course.id"
                    (change)="onCourseImageSelected(course, $event)"
                    class="w-full rounded border border-gold-500/20 bg-obsidian-800 px-3 py-2 text-xs"
                  />
                  @if (course.hero_image_url) {
                    <img [src]="course.hero_image_url" alt="Preview do curso" class="h-24 w-full rounded object-cover" />
                  }
                  @if (imageUploading()[course.id]) {
                    <p class="text-xs text-gold-300">Enviando imagem...</p>
                  }
                </div>
                <button type="submit" class="rounded border border-gold-500/40 px-3 py-2 text-xs text-gold-300 hover:bg-gold-500/10">Salvar Curso</button>
                <button
                  type="button"
                  (click)="deleteCourse(course)"
                  class="ml-2 rounded border border-red-400/40 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10"
                >
                  Excluir curso
                </button>
              </form>
            }
          </div>
        </article>

        <article class="mb-4 rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-4">
          <h2 class="mb-4 text-lg font-medium text-gold-300">Editar Perfil do Aluno</h2>
          <form class="space-y-3" (ngSubmit)="saveStudentProfile()">
            <input
              [(ngModel)]="studentProfile.name"
              name="studentProfileName"
              required
              placeholder="Nome"
              class="w-full rounded-lg border border-gold-500/20 bg-obsidian-800 px-3 py-2 text-sm"
            />
            <input
              [(ngModel)]="studentProfile.email"
              name="studentProfileEmail"
              type="email"
              required
              placeholder="Email"
              class="w-full rounded-lg border border-gold-500/20 bg-obsidian-800 px-3 py-2 text-sm"
            />
            <input
              [(ngModel)]="studentProfile.studentLevel"
              name="studentProfileLevel"
              required
              placeholder="Nível (ex: Platinum Scholar)"
              class="w-full rounded-lg border border-gold-500/20 bg-obsidian-800 px-3 py-2 text-sm"
            />
            <input
              [(ngModel)]="studentProfile.avatarUrl"
              name="studentProfileAvatar"
              placeholder="URL do avatar"
              class="w-full rounded-lg border border-gold-500/20 bg-obsidian-800 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              [disabled]="profileSaving()"
              class="rounded-lg border border-gold-500/40 px-3 py-2 text-xs font-semibold text-gold-300 hover:bg-gold-500/10 disabled:opacity-60"
            >
              {{ profileSaving() ? 'Salvando perfil...' : 'Salvar perfil do aluno' }}
            </button>
          </form>
        </article>

        <section class="chat-panel">
          <header class="chat-header">
            <div>
              <p class="text-sm font-semibold text-gold-300">Chat com Aluno</p>
              <p class="text-xs text-slate-400">{{ selectedStudentName() || 'Selecione um aluno' }}</p>
            </div>
            <span class="rounded-full border border-gold-500/30 px-2 py-0.5 text-xs text-gold-300">Admin</span>
          </header>

          <div class="border-b border-gold-500/20 px-3 py-2">
            <select
              [(ngModel)]="selectedUserId"
              (ngModelChange)="onStudentChange()"
              name="selectedUserId"
              class="mb-2 w-full rounded-lg border border-gold-500/20 bg-obsidian-900 px-3 py-2 text-sm"
            >
              @for (student of admin.students(); track student.id) {
                <option [ngValue]="student.id">{{ student.name }} ({{ student.email }})</option>
              }
            </select>
            <select
              [(ngModel)]="selectedCourseId"
              name="selectedCourseId"
              class="w-full rounded-lg border border-gold-500/20 bg-obsidian-900 px-3 py-2 text-sm"
            >
              <option [ngValue]="null">Sem curso específico</option>
              @for (course of admin.courses(); track course.id) {
                <option [ngValue]="course.id">{{ course.title }}</option>
              }
            </select>
          </div>

          <div class="chat-body">
            @if (chatMessagesForStudent().length === 0) {
              <p class="text-center text-sm text-slate-500">Nenhuma mensagem enviada para este aluno.</p>
            } @else {
              @for (message of chatMessagesForStudent(); track message.id) {
                <div class="chat-row chat-row-out">
                  <div>
                    <article class="chat-bubble chat-bubble-out">
                      <p class="font-semibold">{{ message.subject }}</p>
                      @if (courseTitle(message.course_id)) {
                        <p class="mt-1 text-xs text-gold-200/80">{{ courseTitle(message.course_id) }}</p>
                      }
                      <p class="mt-2 whitespace-pre-wrap leading-relaxed">{{ message.details }}</p>
                    </article>
                    <p class="chat-meta text-right">{{ formatTime(message.created_at) }}</p>
                  </div>
                  <div class="chat-avatar">AD</div>
                </div>
              }
            }
          </div>

          <form class="chat-composer space-y-2" (ngSubmit)="sendDetails()">
            <input
              [(ngModel)]="subject"
              name="subject"
              required
              placeholder="Assunto da mensagem..."
              class="chat-input"
            />
            <textarea
              [(ngModel)]="details"
              name="details"
              required
              rows="3"
              placeholder="Digite sua mensagem para o aluno..."
              class="chat-input"
            ></textarea>
            <div class="flex justify-end">
              <button type="submit" [disabled]="loading()" class="chat-send-btn">
                {{ loading() ? 'Enviando...' : 'Enviar mensagem' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </section>
  `,
})
export class SuperAdminDashboardComponent implements OnInit {
  readonly admin = inject(AdminService);
  private readonly auth = inject(AuthService);

  selectedUserId: number | null = null;
  selectedCourseId: number | null = null;
  subject = '';
  details = '';
  readonly loading = signal(false);
  readonly profileSaving = signal(false);
  readonly imageUploading = signal<Record<number, boolean>>({});
  newCourse = this.emptyCourseForm();
  studentProfile = {
    name: '',
    email: '',
    studentLevel: '',
    avatarUrl: '',
  };

  async ngOnInit(): Promise<void> {
    await this.admin.loadDashboardData();
    const firstStudent = this.admin.students()[0];
    if (firstStudent) {
      this.selectedUserId = firstStudent.id;
      this.onStudentChange();
    }
  }

  onStudentChange(): void {
    const student = this.admin.students().find((item) => item.id === this.selectedUserId);
    if (!student) return;
    this.studentProfile = {
      name: student.name,
      email: student.email,
      studentLevel: student.student_level,
      avatarUrl: student.avatar_url ?? '',
    };
  }

  async saveStudentProfile(): Promise<void> {
    if (!this.selectedUserId) {
      this.admin.error.set('Selecione um aluno para editar o perfil.');
      return;
    }
    this.profileSaving.set(true);
    try {
      await this.admin.updateStudent(this.selectedUserId, {
        name: this.studentProfile.name,
        email: this.studentProfile.email,
        studentLevel: this.studentProfile.studentLevel,
        avatarUrl: this.studentProfile.avatarUrl || null,
      });
      this.onStudentChange();
    } catch {
      // handled by AdminService
    } finally {
      this.profileSaving.set(false);
    }
  }

  async saveCourse(course: AdminCourse): Promise<void> {
    await this.admin.updateCourse(course);
  }

  async createNewCourse(): Promise<void> {
    await this.admin.createCourse(this.newCourse);
    this.newCourse = this.emptyCourseForm();
  }

  async onCourseImageSelected(course: AdminCourse, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.setImageUploading(course.id, true);
    try {
      const imageUrl = await this.admin.uploadCourseImage(file);
      course.hero_image_url = imageUrl;
      await this.admin.updateCourse(course);
    } catch {
      // Error message is handled by AdminService signal.
    } finally {
      this.setImageUploading(course.id, false);
      input.value = '';
    }
  }

  async deleteCourse(course: AdminCourse): Promise<void> {
    const confirmed = window.confirm(`Tem certeza que deseja excluir o curso "${course.title}"?`);
    if (!confirmed) return;
    await this.admin.deleteCourse(course.id, course.title);
  }

  async sendDetails(): Promise<void> {
    if (!this.selectedUserId) {
      this.admin.error.set('Selecione um aluno antes de enviar a mensagem.');
      return;
    }
    if (!this.subject.trim() || !this.details.trim()) {
      this.admin.error.set('Preencha assunto e detalhes da mensagem.');
      return;
    }

    this.loading.set(true);
    try {
      await this.admin.sendStudentDetails({
        userId: this.selectedUserId,
        courseId: this.selectedCourseId,
        subject: this.subject,
        details: this.details,
      });
      this.subject = '';
      this.details = '';
    } catch {
      // Error handled by AdminService.
    } finally {
      this.loading.set(false);
    }
  }

  logout(): void {
    this.auth.logout();
    location.href = '/admin/login';
  }

  private setImageUploading(courseId: number, value: boolean): void {
    this.imageUploading.update((state) => ({ ...state, [courseId]: value }));
  }

  selectedStudentName(): string {
    const student = this.admin.students().find((item) => item.id === this.selectedUserId);
    return student?.name ?? '';
  }

  chatMessagesForStudent() {
    if (!this.selectedUserId) return [];
    return this.admin
      .sentMessages()
      .filter((message) => message.user_id === this.selectedUserId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  courseTitle(courseId: number | null): string {
    if (!courseId) return '';
    return this.admin.courses().find((course) => course.id === courseId)?.title ?? '';
  }

  formatTime(value: string): string {
    return new Date(value).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private emptyCourseForm() {
    return {
      title: '',
      description: '',
      price: 0,
      category: '',
      rating: 4.8,
      hero_image_url: '',
    };
  }
}
