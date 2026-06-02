import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

interface AuthProfile {
  id: number;
  name: string;
  email: string;
  is_admin: boolean;
  is_instructor: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = environment.apiUrl;
  private readonly tokenKey = 'elite_token';
  private readonly roleKey = 'elite_role';
  private readonly _token = signal<string | null>(localStorage.getItem(this.tokenKey));
  private readonly _isAdmin = signal(localStorage.getItem(this.roleKey) === 'admin');
  private readonly _isInstructor = signal(localStorage.getItem(this.roleKey) === 'instructor');

  readonly token = this._token.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token());
  readonly isAdmin = this._isAdmin.asReadonly();
  readonly isInstructor = this._isInstructor.asReadonly();
  readonly isContentManager = computed(() => this._isAdmin() || this._isInstructor());
  readonly isStudent = computed(() => !this.isContentManager());

  constructor(private readonly http: HttpClient) {}

  async register(payload: { name: string; email: string; password: string }): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.apiUrl}/auth/register`, {
        name: payload.name,
        email: payload.email,
        password: payload.password,
      }),
    );
  }

  async login(email: string, password: string): Promise<void> {
    const body = new URLSearchParams({ username: email, password }).toString();
    const response = await firstValueFrom(
      this.http.post<{ access_token: string }>(`${this.apiUrl}/auth/login`, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    );
    this._token.set(response.access_token);
    localStorage.setItem(this.tokenKey, response.access_token);
    await this.loadProfile();
  }

  async loadProfile(): Promise<AuthProfile> {
    const me = await firstValueFrom(this.http.get<AuthProfile>(`${this.apiUrl}/me`));
    this._isAdmin.set(!!me.is_admin);
    this._isInstructor.set(!!me.is_instructor && !me.is_admin);
    const role = me.is_admin ? 'admin' : me.is_instructor ? 'instructor' : 'student';
    localStorage.setItem(this.roleKey, role);
    return me;
  }

  logout(): void {
    this._token.set(null);
    this._isAdmin.set(false);
    this._isInstructor.set(false);
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.roleKey);
  }
}
