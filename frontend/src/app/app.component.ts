import { Component } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { SideNavComponent } from './shared/side-nav.component';
import { TopAppBarComponent } from './shared/top-app-bar.component';
import { AuthService } from './services/auth.service';
import { PortalDataService } from './services/portal-data.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SideNavComponent, TopAppBarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  readonly student = this.data.student;
  showShell = true;

  constructor(
    private readonly data: PortalDataService,
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {
    this.showShell = this.shouldShowShell(this.router.url);
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.showShell = this.shouldShowShell(this.router.url);
    });

    if (this.auth.isAuthenticated()) {
      void this.initializeSession();
    }
  }

  logout(): void {
    this.auth.logout();
    this.data.clear();
    void this.router.navigateByUrl('/login');
  }

  private shouldShowShell(url: string): boolean {
    return (
      url !== '/login' &&
      url !== '/matricula' &&
      url !== '/admin/login' &&
      !url.startsWith('/admin/')
    );
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
