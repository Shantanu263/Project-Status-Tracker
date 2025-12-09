import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = environment.apiUrl + '/auth';

  constructor(private http: HttpClient) {}

  login(email: string, password: string) {
    return this.http.post<{ accessToken: string, refreshToken: string }>(`${this.api}/login`, { email, password }).pipe(
      tap(res => {
        sessionStorage.setItem('accessToken', res.accessToken);
        sessionStorage.setItem('refreshToken', res.refreshToken);
      })
    );
  }

  signup(name: string, email: string, password: string) {
    return this.http.post<{ token: string }>(`${this.api}/signup`, { name, email, password }).pipe(
      tap(res => {
        sessionStorage.setItem('accessToken', res.token);
      })
    );
  }

  logout() {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
  }

  isLoggedIn() {
    return !!(sessionStorage.getItem('accessToken') || sessionStorage.getItem('refreshToken'));
  }

  getToken() {
    return sessionStorage.getItem('accessToken');
  }
}
