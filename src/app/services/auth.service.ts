import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, Observable } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = environment.apiUrl + '/auth';

  constructor(private http: HttpClient, private router: Router) { }

  login(email: string, password: string) {
    return this.http.post<{ accessToken: string, refreshToken: string }>(`${this.api}/login`, { email, password }).pipe(
      tap(res => {
        sessionStorage.setItem('accessToken', res.accessToken);
        sessionStorage.setItem('refreshToken', res.refreshToken);
      })
    );
  }

  signup(name: string, email: string, password: string) {
    return this.http.post<{ token: string }>(`${this.api}/signup`, { name, email, password });
  }

  refreshToken(): Observable<{ accessToken: string }> {
    const refreshToken = sessionStorage.getItem('refreshToken');
    return this.http.post<{ accessToken: string }>(`${this.api}/refresh-token`, { refreshToken }).pipe(
      tap(res => {
        sessionStorage.setItem('accessToken', res.accessToken);
      })
    );
  }

  logout() {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
  }

  logoutWithMessage(message: string) {
    this.logout();
    alert(message);
    this.router.navigate(['/auth']);
  }

  isLoggedIn() {
    return !!(sessionStorage.getItem('accessToken') || sessionStorage.getItem('refreshToken'));
  }

  getToken() {
    return sessionStorage.getItem('accessToken');
  }

  getRefreshToken() {
    return sessionStorage.getItem('refreshToken');
  }

  getCurrentUserId(): number | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      // Decode JWT token (format: header.payload.signature)
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.userId || payload.sub || null;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  getCurrentUserName(): string | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      // Decode JWT token (format: header.payload.signature)
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.name || payload.sub || null;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  getUserRole(): string | null {
    const token = this.getToken();
    if (!token) {
      console.log('No token found');
      return null;
    }

    try {
      // Decode JWT token (format: header.payload.signature)
      const payload = JSON.parse(atob(token.split('.')[1]));
      // console.log('JWT Payload:', payload);
      // console.log('User Role:', payload.role);
      return payload.role || null;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  isSuperAdmin(): boolean {
    const role = this.getUserRole();
    //console.log('Checking if super admin, role:', role);
    return role?.toUpperCase() === 'SUPER_ADMIN' || role?.toUpperCase() === 'SUPER ADMIN';
  }
}
