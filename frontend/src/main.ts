import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig).catch((err) => {
  console.error(err);
  const message = err instanceof Error ? err.message : String(err);
  document.body.innerHTML = `
    <div style="margin:2rem auto;max-width:32rem;padding:1.5rem;font-family:Segoe UI,sans-serif;color:#f8d7da;background:#1a1a1b;border:1px solid #d4af37;border-radius:12px;">
      <h1 style="margin:0 0 .75rem;font-size:1.1rem;color:#d4af37;">Erro ao carregar o portal</h1>
      <p style="margin:0 0 1rem;font-size:.9rem;line-height:1.5;">Atualize a página com Ctrl+F5. Se continuar, limpe o cache do navegador.</p>
      <pre style="margin:0;font-size:.75rem;white-space:pre-wrap;color:#94a3b8;">${message}</pre>
    </div>`;
});
