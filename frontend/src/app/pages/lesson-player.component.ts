import { Component, effect, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { PortalDataService } from '../services/portal-data.service';

@Component({
  selector: 'app-lesson-player',
  standalone: true,
  imports: [NgClass],
  template: `
    <section class="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <aside class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-4 xl:col-span-3">
        <h4 class="mb-3 text-gold-300">Modules</h4>
        @for (lesson of data.lessons(); track lesson.id) {
          <button
            (click)="selectedLesson.set(lesson.id)"
            class="mb-2 block w-full rounded-lg border px-3 py-2 text-left text-sm"
            [ngClass]="selectedLesson() === lesson.id ? 'border-gold-500' : 'border-gold-500/20'"
          >
            <span class="block">{{ lesson.moduleName }}</span>
            <span class="text-xs text-slate-400">{{ lesson.title }}</span>
          </button>
        }
      </aside>

      <div class="space-y-4 xl:col-span-9">
        <div class="aspect-video rounded-xl border border-gold-500/30 bg-obsidian-800 p-2">
          <div class="flex h-full items-center justify-center rounded-lg bg-black/40 text-gold-300">
            16:9 Lesson Video Player
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <article class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-4 lg:col-span-2">
            <h5 class="text-gold-300">Lesson Description</h5>
            <p class="mt-2 text-sm text-slate-300">Deep dive into architecture choices, implementation strategy and deployment patterns.</p>
            <button
              (click)="markProgress()"
              class="mt-4 rounded-lg border border-gold-500/40 px-3 py-2 text-xs text-gold-300 hover:bg-gold-500/10"
            >
              Mark +10% Progress
            </button>
          </article>
          <article class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-4">
            <h5 class="text-gold-300">Resources</h5>
            <ul class="mt-2 space-y-2 text-sm text-slate-300">
              <li>Download Slides.pdf</li>
              <li>Architecture Checklist.docx</li>
              <li>Source Bundle.zip</li>
            </ul>
          </article>
        </div>
      </div>
    </section>
  `,
})
export class LessonPlayerComponent {
  readonly data = inject(PortalDataService);
  readonly selectedLesson = signal(1);

  constructor() {
    effect(() => {
      const firstEnrollment = this.data.activeCourses()[0];
      if (!firstEnrollment) return;
      void this.data.loadLessonsForCourse(firstEnrollment.courseId);
    });
  }

  markProgress(): void {
    const first = this.data.activeCourses()[0];
    if (!first) return;
    void this.data.updateProgress(first.courseId, first.progressPercentage + 10);
  }
}
