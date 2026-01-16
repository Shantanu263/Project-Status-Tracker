import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

interface VerifyEmailResponse {
    message: string;
}

interface VerifyOtpResponse {
    resetToken: string;
}

interface ResetPasswordResponse {
    message: string;
}

@Injectable({
    providedIn: 'root'
})
export class ForgotPasswordService {
    private http = inject(HttpClient);
    private api = environment.apiUrl + '/forgot-password';

    /**
     * Step 1: Verify email and send OTP
     */
    verifyEmail(email: string): Observable<VerifyEmailResponse> {
        return this.http.post<VerifyEmailResponse>(`${this.api}/verifyMail`, { email });
    }

    /**
     * Step 2: Verify OTP and get reset token
     */
    verifyOtp(email: string, otp: number): Observable<VerifyOtpResponse> {
        return this.http.post<VerifyOtpResponse>(`${this.api}/verifyOtp`, { email, otp });
    }

    /**
     * Step 3: Reset password with token
     */
    resetPassword(newPassword: string, resetToken: string): Observable<ResetPasswordResponse> {
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${resetToken}`
        });
        return this.http.post<ResetPasswordResponse>(
            `${this.api}/reset-password`,
            { newPassword },
            { headers }
        );
    }
}
