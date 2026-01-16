import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { tap } from 'rxjs';

export const globalHttpErrorInterceptorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);

  return next(req).pipe(
    tap({
      error: (error: HttpErrorResponse) => {
        // Default message 
        let errorMessage = 'An unexpected error occurred';

        if (error.error) {
          if (typeof error.error === 'string') {
            errorMessage = error.error;
          } else if (error.error.message) {
            errorMessage = error.error.message;
          }
        }

        if (req.url.includes('/auth/login') || req.url.includes('/auth/signup')) {
          //console.log(errorMessage);
          snackBar.open(errorMessage, 'Close', {
            duration: 5000
          });
        }
        else {
          if (!req.url.includes('/forgot-password')) {
            snackBar.open(errorMessage, 'Close', {
              duration: 5000
            });
          }
        }
      }
    })
  );
};
