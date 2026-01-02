import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export interface UserRole {
    roleName: string;
}

export interface User {
    userId: number;
    name: string;
    email: string;
    role: UserRole;
    createdAt: string;
}

export interface PaginatedUsersResponse {
    content: User[];
    page: number;
    size: number;
    totalPages: number;
    totalElements: number;
    sortBy: string;
    order: string;
    search?: string;
}

@Injectable({
    providedIn: 'root'
})
export class UserManagementService {
    private apiUrl = environment.apiUrl + '/admin';

    constructor(private http: HttpClient) { }

    getUsers(
        page: number = 0,
        size: number = 10,
        sortBy: string = 'createdAt',
        order: string = 'desc',
        search: string = ''
    ): Observable<PaginatedUsersResponse> {
        let params = new HttpParams()
            .set('page', page.toString())
            .set('size', size.toString())
            .set('sortBy', sortBy)
            .set('order', order);

        if (search) {
            params = params.set('search', search);
        }

        return this.http.get<PaginatedUsersResponse>(`${this.apiUrl}/users`, { params });
    }

    changeUserRole(userId: number, roleName: string): Observable<any> {
        return this.http.put(`${this.apiUrl}/change-role/${userId}`, { roleName });
    }
}
