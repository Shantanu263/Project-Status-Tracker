import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import DOMPurify from 'isomorphic-dompurify';

export interface ProjectSummaryPayload {
    currentStatusHtml: string;
    nextStepsHtml: string;
    recentlyCompletedTasks?: boolean;
    upcomingTasks?: boolean;
}

export interface EmailSummaryPayload extends ProjectSummaryPayload {
    email: string;
}

@Injectable({
    providedIn: 'root'
})
export class ProjectSummaryService {
    private http = inject(HttpClient);
    private api = environment.apiUrl + '/project';

    /**
     * Download project summary as PDF
     */
    downloadProjectSummary(projectId: number, payload: ProjectSummaryPayload): Observable<Blob> {
        const sanitizedPayload: any = {
            currentStatusHtml: this.sanitizeHtml(payload.currentStatusHtml),
            nextStepsHtml: this.sanitizeHtml(payload.nextStepsHtml)
        };

        if (payload.recentlyCompletedTasks) {
            sanitizedPayload.recentlyCompletedTasks = true;
        }
        if (payload.upcomingTasks) {
            sanitizedPayload.upcomingTasks = true;
        }

        return this.http.post(`${this.api}/${projectId}/summary/pdf`, sanitizedPayload, {
            responseType: 'blob'
        });
    }

    /**
     * Email project summary
     */
    emailProjectSummary(projectId: number, payload: EmailSummaryPayload): Observable<void> {
        const sanitizedPayload: any = {
            email: payload.email,
            currentStatusHtml: this.sanitizeHtml(payload.currentStatusHtml),
            nextStepsHtml: this.sanitizeHtml(payload.nextStepsHtml)
        };

        if (payload.recentlyCompletedTasks) {
            sanitizedPayload.recentlyCompletedTasks = true;
        }
        if (payload.upcomingTasks) {
            sanitizedPayload.upcomingTasks = true;
        }

        return this.http.post<void>(`${this.api}/${projectId}/summary/pdf/email`, sanitizedPayload);
    }

    /**
     * Sanitize HTML to only allow safe tags for PDF generation
     * Allowed tags: ul, li, p, strong, em, br
     */
    private sanitizeHtml(html: string): string {
        if (!html) return '';

        // Configure DOMPurify to allow only PDF-safe tags
        const config = {
            ALLOWED_TAGS: ['ul', 'li', 'p', 'strong', 'em', 'br', 'ol', 'b', 'i'],
            ALLOWED_ATTR: [],
            KEEP_CONTENT: true
        };

        return DOMPurify.sanitize(html, config);
    }
}
