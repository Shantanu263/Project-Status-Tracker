import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, take } from 'rxjs/operators';
import { throwError, BehaviorSubject } from 'rxjs';
import { AuthService } from '../services/auth.service';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const JwtInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  
  // Skip interceptor for refresh-token endpoint to prevent infinite loop
  if (req.url.includes('/auth/refresh-token')) {
    return next(req);
  }

  const token = auth.getToken();

  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  return next(req).pipe(
    catchError(error => {
      // Handle 403 Forbidden response (expired access token)
      if (error.status === 403) {
        const refreshToken = auth.getRefreshToken();

        // If no refresh token exists, logout with session expired message
        if (!refreshToken) {
          auth.logoutWithMessage('Session expired. Please login again.');
          return throwError(() => error);
        }

        // Prevent multiple simultaneous refresh attempts
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
              // If refresh fails, logout with session expired message
              auth.logoutWithMessage('Session expired. Please login again.');
              return throwError(() => refreshError);
            })
          );
        } else {
          // If refresh is already in progress, wait for the new token
          return refreshTokenSubject.pipe(
            take(1),
            switchMap(newToken => {
              if (newToken) {
                const clonedReq = req.clone({
                  setHeaders: { Authorization: `Bearer ${newToken}` }
                });
                return next(clonedReq);
              }
              return throwError(() => error);
            })
          );
        }
      }

      return throwError(() => error);
    })
  );
};
