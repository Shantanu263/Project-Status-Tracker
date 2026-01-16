import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

interface UpdateUsernameResponse {
    message: string;
    username: string;
}

interface UpdatePasswordResponse {
    message: string;
}

export interface UserDetailsResponse {
    userId: number;
    name: string;
    email: string;
    createdAt: string;
    role: {
        roleName: string;
    };
    isUserActive: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class UserAccountService {
    private http = inject(HttpClient);
    private api = environment.apiUrl + '/auth/user';

    /**
     * Get user details
     * @param userId User ID
     */
    getUserDetails(userId: number): Observable<UserDetailsResponse> {
        return this.http.get<UserDetailsResponse>(`${this.api}/${userId}`);
    }

    /**
     * Update username for a user
     * @param userId User ID
     * @param username New username
     */
    updateUsername(userId: number, username: string): Observable<UpdateUsernameResponse> {
        const params = new HttpParams().set('username', username);
        return this.http.patch<UpdateUsernameResponse>(
            `${this.api}/${userId}/update-username`,
            null,
            { params }
        );
    }

    /**
     * Update password for a user (after login)
     * @param userId User ID
     * @param oldPassword Current password
     * @param newPassword New password
     */
    updatePassword(userId: number, oldPassword: string, newPassword: string): Observable<UpdatePasswordResponse> {
        return this.http.patch<UpdatePasswordResponse>(
            `${this.api}/${userId}/update-password`,
            { oldPassword, newPassword }
        );
    }
}
