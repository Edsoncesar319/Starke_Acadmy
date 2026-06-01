import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

interface AuthProfile {
  id: number;
  name: string;
  email: string;
  is_admin: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = environment.apiUrl;
  private readonly tokenKey = 'elite_token';
  private readonly roleKey = 'elite_role';
  private readonly _token = signal<string | null>(localStorage.getItem(this.tokenKey));
  private readonly _isAdmin = signal(localStorage.getItem(this.roleKey) === 'admin');

  readonly token = this._token.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token());
  readonly isAdmin = this._isAdmin.asReadonly();

  constructor(private readonly http: HttpClient) {}

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
    localStorage.setItem(this.roleKey, me.is_admin ? 'admin' : 'student');
    return me;
  }

  logout(): void {
    this._token.set(null);
    this._isAdmin.set(false);
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.roleKey);
  }
}
