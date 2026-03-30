import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import { BulkDelayLogPayload, BulkDelayLogResponse, BulkDeleteDelayPayload, BulkUpdateDelayPayload, BulkUpdateDelayResponse, CreateDelayLogPayload, DelayLog, UpdateDelayLogPayload } from '../models/delay-tracker.model';

@Injectable({
    providedIn: 'root'
})
export class DelayTrackerService {
    private readonly api = `${environment.apiUrl}/project`;

    constructor(private http: HttpClient) {}

    getDelayLogs(projectId: number): Observable<DelayLog[]> {
        return this.http.get<DelayLog[]>(`${this.api}/${projectId}/delay-tracker`);
    }

    createDelayLog(projectId: number, payload: CreateDelayLogPayload): Observable<DelayLog> {
        return this.http.post<DelayLog>(`${this.api}/${projectId}/delay-tracker`, payload);
    }

    updateDelayLog(projectId: number, delayLogId: number, payload: UpdateDelayLogPayload): Observable<DelayLog> {
        return this.http.put<DelayLog>(`${this.api}/${projectId}/delay-tracker/${delayLogId}`, payload);
    }

    deleteDelayLog(projectId: number, delayLogId: number): Observable<void> {
        return this.http.delete<void>(`${this.api}/${projectId}/delay-tracker/${delayLogId}`);
    }

    bulkAddDelayLogs(projectId: number, payload: BulkDelayLogPayload): Observable<BulkDelayLogResponse> {
        return this.http.post<BulkDelayLogResponse>(`${this.api}/${projectId}/delay-tracker/bulk-add`, payload);
    }

    bulkUpdateDelayLogs(projectId: number, payload: BulkUpdateDelayPayload): Observable<BulkUpdateDelayResponse> {
        return this.http.put<BulkUpdateDelayResponse>(`${this.api}/${projectId}/delay-tracker/bulk-update`, payload);
    }

    bulkDeleteDelayLogs(projectId: number, payload: BulkDeleteDelayPayload): Observable<void> {
        return this.http.delete<void>(`${this.api}/${projectId}/delay-tracker/bulk-delete`, { body: payload });
    }

    exportDelayReport(projectId: number, delayIds: number[]): Observable<Blob> {
        return this.http.post(
            `${this.api}/${projectId}/delay-tracker/pdf`,
            { delayIds },
            { responseType: 'blob' }
        );
    }

    /** Client-side helper: compute delay in days between two yyyy-MM-dd strings */
    calculateDelayDuration(originalDate: string, revisedDate: string): number {
        const parse = (s: string) => {
            // Accept both yyyy-MM-dd and dd-MM-yyyy
            if (!s) return NaN;
            const parts = s.split('-');
            if (parts[0].length === 4) {
                return new Date(`${parts[0]}-${parts[1]}-${parts[2]}`).getTime();
            } else {
                return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
            }
        };
        const diffMs = parse(revisedDate) - parse(originalDate);
        return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }
}
