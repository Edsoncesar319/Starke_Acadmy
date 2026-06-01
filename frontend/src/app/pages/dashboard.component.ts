import { Component, OnInit, computed, inject } from '@angular/core';
import { PortalDataService } from '../services/portal-data.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <section class="space-y-6">
      <div class="rounded-xl border border-gold-500/30 bg-obsidian-700/70 p-6">
        <p class="text-gold-300">Welcome back, {{ data.student().name }}</p>
        <h3 class="mt-2 text-2xl font-semibold">Pending Tasks: {{ pendingTasks() }}</h3>
        @if (data.error()) {
          <p class="mt-2 text-sm text-red-300">{{ data.error() }}</p>
        }
      </div>

      <div>
        <h4 class="mb-3 text-lg font-medium text-gold-300">Active Courses</h4>
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          @for (item of data.activeCourses(); track item.id) {
            <article class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-4">
              <p class="text-sm text-slate-300">{{ item.course?.title }}</p>
              <div class="mt-3 flex items-center gap-3">
                <div class="relative h-14 w-14 rounded-full border-4 border-gold-500/30">
                  <div
                    class="absolute inset-0 rounded-full border-4 border-gold-500"
                    [style.clip-path]="'inset(' + (100 - item.progressPercentage) + '% 0 0 0)'"
                  ></div>
                </div>
                <div>
                  <p class="text-xl font-semibold text-gold-300">{{ item.progressPercentage }}%</p>
                  <p class="text-xs text-slate-400">Completed</p>
                </div>
              </div>
            </article>
          }
        </div>
      </div>

      <section class="chat-panel">
        <header class="chat-header">
          <div>
            <p class="text-sm font-semibold text-gold-300">Chat com a Academia</p>
            <p class="text-xs text-slate-400">Mensagens do seu mentor e equipe Starke</p>
          </div>
          @if (data.unreadMessagesCount() > 0) {
            <span class="rounded-full bg-gold-500 px-2 py-0.5 text-xs font-semibold text-obsidian-900">
              {{ data.unreadMessagesCount() }} nova(s)
            </span>
          }
        </header>

        <div class="chat-body">
          @if (chatMessages().length === 0) {
            <p class="text-center text-sm text-slate-500">Nenhuma mensagem ainda. Quando a academia enviar, aparecerá aqui.</p>
          } @else {
            @for (message of chatMessages(); track message.id) {
              <div class="chat-row chat-row-in">
                <div class="chat-avatar">SA</div>
                <div>
                  <article class="chat-bubble chat-bubble-in">
                    <p class="font-semibold text-gold-300">{{ message.subject }}</p>
                    @if (courseTitle(message.courseId)) {
                      <p class="mt-1 text-xs text-gold-400/80">{{ courseTitle(message.courseId) }}</p>
                    }
                    <p class="mt-2 whitespace-pre-wrap leading-relaxed">{{ message.details }}</p>
                  </article>
                  <p class="chat-meta">{{ formatTime(message.createdAt) }}</p>
                </div>
              </div>
            }
          }
        </div>

        <footer class="chat-composer">
          <p class="text-center text-xs text-slate-500">Este chat é somente leitura. Responda pelo Support Center se precisar.</p>
        </footer>
      </section>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-4">
          <h4 class="mb-3 text-gold-300">Upcoming Live</h4>
          <ul class="space-y-2 text-sm text-slate-300">
            <li>Today 19:00 - Mentorship Office Hour</li>
            <li>Tomorrow 20:30 - Product Clinic</li>
            <li>Saturday 10:00 - Elite Networking</li>
          </ul>
        </div>
        <div class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-4">
          <h4 class="mb-3 text-gold-300">Explore Niches</h4>
          <div class="grid grid-cols-3 gap-2 text-xs text-slate-300">
            @for (niche of niches; track niche) {
              <span class="rounded-lg border border-gold-500/20 bg-obsidian-600/60 px-3 py-2 text-center">{{ niche }}</span>
            }
          </div>
        </div>
      </div>
    </section>
  `,
})
export class DashboardComponent implements OnInit {
  readonly data = inject(PortalDataService);
  readonly pendingTasks = computed(() => this.data.activeCourses().filter((item) => item.progressPercentage < 100).length);
  readonly chatMessages = computed(() =>
    [...this.data.messages()].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    ),
  );
  readonly niches = ['Technology', 'Business', 'Health', 'Design', 'Finance', 'Leadership'];

  ngOnInit(): void {
    this.data.markMessagesAsSeen();
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
