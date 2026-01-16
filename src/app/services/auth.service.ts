import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, Observable } from 'rxjs';
import { environment } from '../environments/environment';
import { ProjectStateService } from './project-state.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = environment.apiUrl + '/auth';
  private http = inject(HttpClient);
  private router = inject(Router);
  private projectStateService = inject(ProjectStateService);

  // Signal to store updated username for immediate UI updates
  private updatedUsername = signal<string | null>(null);

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
    this.clearUpdatedUsername();
    // Clear all project-specific UI state
    this.projectStateService.clearAllProjectState();
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
    // Return updated username if available (for immediate UI updates)
    const updated = this.updatedUsername();
    if (updated !== null) {
      return updated;
    }

    // Otherwise, get from token
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

  /**
   * Update the username signal for immediate UI updates
   * This is called when username is updated via the account panel
   */
  setUpdatedUsername(username: string | null): void {
    this.updatedUsername.set(username);
  }

  /**
   * Clear the updated username signal (e.g., on logout)
   */
  clearUpdatedUsername(): void {
    this.updatedUsername.set(null);
  }

  getCurrentUserEmail(): string | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      // Decode JWT token (format: header.payload.signature)
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.email || null;
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

  canManageProject(projectMembers: any[], currentUserId: number | null): boolean {
    // Check global role first
    if (this.isSuperAdmin()) {
      return true;
    }

    // Check project role
    if (!currentUserId) return false;

    const member = projectMembers?.find(m => m.userId === currentUserId);
    return member?.role?.toUpperCase() === 'SUPER_ADMIN' || member?.role?.toUpperCase() === 'SUPER ADMIN';
  }

  /**
   * Token refresh buffer in seconds
   * Token will be refreshed when it expires within this time window
   */
  private readonly TOKEN_REFRESH_BUFFER_SECONDS = 30;

  /**
   * Get the expiry time of the current access token
   * @returns Expiry time in seconds (Unix timestamp) or null if token is invalid
   */
  getTokenExpiryTime(): number | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp || null;
    } catch (error) {
      console.error('Error decoding token expiry:', error);
      return null;
    }
  }

  /**
   * Check if the access token is expiring soon
   * @param bufferSeconds Optional custom buffer (defaults to TOKEN_REFRESH_BUFFER_SECONDS)
   * @returns true if token expires within the buffer time
   */
  isTokenExpiringSoon(bufferSeconds?: number): boolean {
    const expiryTime = this.getTokenExpiryTime();
    if (!expiryTime) return false;

    const buffer = bufferSeconds ?? this.TOKEN_REFRESH_BUFFER_SECONDS;
    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
    const timeUntilExpiry = expiryTime - currentTime;

    return timeUntilExpiry <= buffer && timeUntilExpiry > 0;
  }

  /**
   * Check if the access token is already expired
   * @returns true if token is expired
   */
  isTokenExpired(): boolean {
    const expiryTime = this.getTokenExpiryTime();
    if (!expiryTime) return true;

    const currentTime = Math.floor(Date.now() / 1000);
    return currentTime >= expiryTime;
  }

  /**
   * Determine if token should be proactively refreshed
   * @returns true if token should be refreshed
   */
  shouldRefreshToken(): boolean {
    const token = this.getToken();
    const refreshToken = this.getRefreshToken();

    // Need both tokens to refresh
    if (!token || !refreshToken) return false;

    // Refresh if token is expiring soon or already expired
    return this.isTokenExpiringSoon() || this.isTokenExpired();
  }
}
