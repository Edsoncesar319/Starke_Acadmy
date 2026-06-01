import { Component } from '@angular/core';

@Component({
  selector: 'app-support-center',
  standalone: true,
  template: `
    <section class="space-y-4">
      <input
        placeholder="Search knowledge base..."
        class="w-full rounded-xl border border-gold-500/30 bg-obsidian-700/60 px-4 py-3 text-sm outline-none"
      />

      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        @for (item of categories; track item.title) {
          <article class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-4">
            <h4 class="text-gold-300">{{ item.title }}</h4>
            <p class="mt-2 text-sm text-slate-300">{{ item.text }}</p>
          </article>
        }
      </div>

      <div class="rounded-xl border border-gold-500/20 bg-obsidian-700/60 p-4">
        <h4 class="mb-3 text-gold-300">FAQ</h4>
        @for (faq of faqs; track faq.q) {
          <details class="mb-2 rounded-lg border border-gold-500/20 px-3 py-2">
            <summary class="cursor-pointer text-sm text-slate-100">{{ faq.q }}</summary>
            <p class="mt-2 text-sm text-slate-300">{{ faq.a }}</p>
          </details>
        }
      </div>

      <div class="flex flex-wrap gap-3">
        <button class="rounded-lg border border-gold-500/40 px-4 py-2 text-sm text-gold-300 hover:bg-gold-500/10">Live Chat</button>
        <button class="rounded-lg border border-gold-500/40 px-4 py-2 text-sm text-gold-300 hover:bg-gold-500/10">Email Desk</button>
        <button class="rounded-lg border border-gold-500/40 px-4 py-2 text-sm text-gold-300 hover:bg-gold-500/10">Community Forum</button>
      </div>
    </section>
  `,
})
export class SupportCenterComponent {
  readonly categories = [
    { title: 'Technical', text: 'Login, playback, and platform issues.' },
    { title: 'Academic', text: 'Curriculum, assessments and mentor guidance.' },
    { title: 'Billing', text: 'Invoices, plans and renewal operations.' },
  ];

  readonly faqs = [
    { q: 'How do I request certificate?', a: 'Complete all modules and visit your profile achievements section.' },
    { q: 'Can I reschedule live sessions?', a: 'Yes, use Upcoming Live and click on session details to request reschedule.' },
    { q: 'Where can I download lesson resources?', a: 'Open Lesson Player and use the Resources panel for each lesson.' },
  ];
}
