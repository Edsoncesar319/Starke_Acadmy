import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { CourseCatalogComponent } from './pages/course-catalog.component';
import { DashboardComponent } from './pages/dashboard.component';
import { LandingComponent } from './pages/landing.component';
import { LessonPlayerComponent } from './pages/lesson-player.component';
import { LoginComponent } from './pages/login.component';
import { ForgotPasswordComponent } from './pages/forgot-password.component';
import { ResetPasswordComponent } from './pages/reset-password.component';
import { MatriculaComponent } from './pages/matricula.component';
import { MyPaymentsComponent } from './pages/my-payments.component';
import { PixPaymentComponent } from './pages/pix-payment.component';
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
  return auth.isAuthenticated() && auth.isAdmin() ? true : router.createUrlTree(['/login']);
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
  { path: '', component: LandingComponent },
  { path: 'login', component: LoginComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'matricula', component: MatriculaComponent },
  { path: 'admin/login', redirectTo: 'login', pathMatch: 'full' },
  { path: 'admin/dashboard', component: SuperAdminDashboardComponent, canActivate: [adminGuard] },
  { path: 'dashboard', component: DashboardComponent, canActivate: [studentGuard] },
  { path: 'catalog', component: CourseCatalogComponent, canActivate: [studentGuard] },
  { path: 'pagamentos', component: MyPaymentsComponent, canActivate: [studentGuard] },
  { path: 'pagamento/:courseId', component: PixPaymentComponent, canActivate: [studentGuard] },
  { path: 'lesson-player', component: LessonPlayerComponent, canActivate: [authGuard] },
  { path: 'support', component: SupportCenterComponent, canActivate: [studentGuard] },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
];
