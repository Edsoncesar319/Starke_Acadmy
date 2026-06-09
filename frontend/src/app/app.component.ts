import { NgClass } from '@angular/common';
import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { SideNavComponent } from './shared/side-nav.component';
import { TopAppBarComponent } from './shared/top-app-bar.component';
import { AuthService } from './services/auth.service';
import { PortalDataService } from './services/portal-data.service';
import { SideNavLayoutService } from './services/side-nav-layout.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgClass, RouterOutlet, SideNavComponent, TopAppBarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  private readonly data = inject(PortalDataService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly layout = inject(SideNavLayoutService);
  readonly student = this.data.student;
  showShell = true;

  constructor() {
    this.showShell = this.shouldShowShell(this.router.url);
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.showShell = this.shouldShowShell(this.router.url);
      void this.refreshProgressOnNavigate();
    });

    if (this.auth.isAuthenticated()) {
      void this.initializeSession();
    }
  }

  pageTitle(): string {
    const path = this.router.url.split('?')[0];
    const titles: Record<string, string> = {
      '/dashboard': 'Painel',
      '/catalog': 'Catálogo de Cursos',
      '/pagamentos': 'Meus Pagamentos',
      '/lesson-player': 'Aulas',
      '/support': 'Central de Ajuda',
      '/profile': 'Meu Perfil',
    };
    if (path.startsWith('/pagamento/')) {
      return 'Pagamento PIX';
    }
    return titles[path] ?? 'Portal do Aluno';
  }

  logout(): void {
    this.auth.logout();
    this.data.clear();
    void this.router.navigateByUrl('/');
  }

  private shouldShowShell(url: string): boolean {
    const path = url.split('?')[0];
    return (
      path !== '/' &&
      path !== '/login' &&
      path !== '/matricula' &&
      path !== '/admin/login' &&
      !path.startsWith('/admin/')
    );
  }

  private async refreshProgressOnNavigate(): Promise<void> {
    if (!this.auth.isAuthenticated() || this.auth.isAdmin() || this.auth.isInstructor()) {
      return;
    }
    const path = this.router.url.split('?')[0];
    const progressRoutes = ['/dashboard', '/lesson-player', '/profile', '/catalog'];
    if (path === '/dashboard') {
      await this.data.refreshDashboardCourseProgress();
      return;
    }
    if (progressRoutes.some((route) => path === route || path.startsWith(route + '/'))) {
      await this.data.refreshEnrollments();
    }
  }

  private async initializeSession(): Promise<void> {
    try {
      const profile = await this.auth.loadProfile();
      if (!profile.is_admin && !profile.is_instructor) {
        await this.data.refreshPortalData();
      }
    } catch {
      this.auth.logout();
      this.data.clear();
      await this.router.navigateByUrl('/login');
    }
  }
}
