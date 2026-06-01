import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { CourseCatalogComponent } from './pages/course-catalog.component';
import { DashboardComponent } from './pages/dashboard.component';
import { AdminLoginComponent } from './pages/admin-login.component';
import { LessonPlayerComponent } from './pages/lesson-player.component';
import { LoginComponent } from './pages/login.component';
import { MatriculaComponent } from './pages/matricula.component';
import { SuperAdminDashboardComponent } from './pages/super-admin-dashboard.component';
import { ProfileComponent } from './pages/profile.component';
import { SupportCenterComponent } from './pages/support-center.component';
import { AuthService } from './services/auth.service';

const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? true : router.createUrlTree(['/login']);
};

const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() && auth.isAdmin() ? true : router.createUrlTree(['/admin/login']);
};

const studentGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
  if (auth.isAdmin()) return router.createUrlTree(['/admin/dashboard']);
  if (auth.isInstructor()) return router.createUrlTree(['/lesson-player']);
  return true;
};

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginComponent },
  { path: 'matricula', component: MatriculaComponent },
  { path: 'admin/login', component: AdminLoginComponent },
  { path: 'admin/dashboard', component: SuperAdminDashboardComponent, canActivate: [adminGuard] },
  { path: 'dashboard', component: DashboardComponent, canActivate: [studentGuard] },
  { path: 'catalog', component: CourseCatalogComponent, canActivate: [studentGuard] },
  { path: 'lesson-player', component: LessonPlayerComponent, canActivate: [authGuard] },
  { path: 'support', component: SupportCenterComponent, canActivate: [studentGuard] },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
];
