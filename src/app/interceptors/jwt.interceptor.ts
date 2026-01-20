import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, filter, take } from 'rxjs/operators';
import { throwError, BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

// State management for token refresh
let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const JwtInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  // Skip interceptor for auth endpoints to prevent infinite loops
  if (req.url.includes('/auth/login') ||
    req.url.includes('/auth/signup') ||
    req.url.includes('/auth/refresh-token')) {
    return next(req);
  }

  const token = auth.getToken();

  // If no token, proceed without authorization header
  if (!token) {
    return next(req);
  }

  // Add authorization header to request
  req = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` }
  });

  // PROACTIVE REFRESH: Check if token is expiring soon
  if (auth.shouldRefreshToken()) {
    // If refresh is not already in progress, start it
    if (!isRefreshing) {
      isRefreshing = true;
      refreshTokenSubject.next(null);

      return auth.refreshToken().pipe(
        switchMap(res => {
          isRefreshing = false;
          const newToken = res.accessToken;
          refreshTokenSubject.next(newToken);

          // Retry the original request with the new token
          const clonedReq = req.clone({
            setHeaders: { Authorization: `Bearer ${newToken}` }
          });
          return next(clonedReq);
        }),
        catchError(refreshError => {
          isRefreshing = false;
          refreshTokenSubject.next(null);
          // If proactive refresh fails, logout
          auth.logoutWithMessage('Session expired. Please login again.');
          return throwError(() => refreshError);
        })
      );
    } else {
      // If refresh is already in progress, wait for the new token
      return refreshTokenSubject.pipe(
        filter(token => token !== null), // Wait for a valid token
        take(1),
        switchMap(newToken => {
          // Retry the original request with the new token
          const clonedReq = req.clone({
            setHeaders: { Authorization: `Bearer ${newToken}` }
          });
          return next(clonedReq);
        })
      );
    }
  }

  // NORMAL REQUEST: Token is not expiring, proceed normally
  return next(req).pipe(
    catchError(error => {
      // FALLBACK: Handle 401 errors that might indicate token expiration
      // Only attempt token refresh for 401 errors, not 403 (forbidden/permission errors)
      if (error.status === 401) {
        const refreshToken = auth.getRefreshToken();

        // If no refresh token exists, logout
        if (!refreshToken) {
          auth.logoutWithMessage('Session expired. Please login again.');
          return throwError(() => error);
        }

        // Check if the error message indicates token expiration
        // If it's a different 401 error (like invalid credentials), don't try to refresh
        const errorMessage = error.error?.message || error.message || '';
        const isTokenExpired = errorMessage.toLowerCase().includes('token') ||
          errorMessage.toLowerCase().includes('expired') ||
          errorMessage.toLowerCase().includes('unauthorized');

        // If it's not a token-related error, just pass it through
        if (!isTokenExpired && errorMessage && !errorMessage.toLowerCase().includes('jwt')) {
          return throwError(() => error);
        }

        // If token refresh is not already in progress, start it
        if (!isRefreshing) {
          isRefreshing = true;
          refreshTokenSubject.next(null);

          return auth.refreshToken().pipe(
            switchMap(res => {
              isRefreshing = false;
              const newToken = res.accessToken;
              refreshTokenSubject.next(newToken);

              // Retry the original request with the new token
              const clonedReq = req.clone({
                setHeaders: { Authorization: `Bearer ${newToken}` }
              });
              return next(clonedReq);
            }),
            catchError(refreshError => {
              isRefreshing = false;
              refreshTokenSubject.next(null);
              // If refresh fails, logout
              auth.logoutWithMessage('Session expired. Please login again.');
              return throwError(() => refreshError);
            })
          );
        } else {
          // If refresh is already in progress, wait for the new token
          return refreshTokenSubject.pipe(
            filter(token => token !== null), // Wait for a valid token
            take(1),
            switchMap(newToken => {
              // Retry the original request with the new token
              const clonedReq = req.clone({
                setHeaders: { Authorization: `Bearer ${newToken}` }
              });
              return next(clonedReq);
            })
          );
        }
      }

      // For 403 (Forbidden) and other errors, just pass them through
      // Don't logout the user - let the error be handled by the component or global error interceptor
      return throwError(() => error);
    })
  );
};
