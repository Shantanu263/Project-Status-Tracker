/**
 * Timeline Service
 * 
 * Handles timeline-specific API operations including:
 * - Fetching phases with tasks
 * - Updating phase and task dates
 * - Date parsing and formatting utilities
 * 
 * Date Format Notes:
 * - Backend returns dates in dd-mm-yyyy format
 * - Backend expects dates in yyyy-mm-dd format for PUT requests
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import { Phase } from '../models/phase.model';

@Injectable({
    providedIn: 'root'
})
export class TimelineService {
    private http = inject(HttpClient);
    private api = environment.apiUrl + '/project';

    /**
     * Fetch phases with nested tasks for a project
     */
    getPhases(projectId: number): Observable<Phase[]> {
        return this.http.get<Phase[]>(`${this.api}/${projectId}/phases`);
    }

    /**
     * Update phase dates
     * PUT /api/project/{projectId}/phase/{phaseId}
     */
    updatePhaseDates(projectId: number, phaseId: number, startDate: string, endDate: string): Observable<any> {
        return this.http.put(
            `${this.api}/${projectId}/phase/${phaseId}`,
            {
                startDate,
                endDate
            }
        );
    }

    /**
     * Update task dates
     * PUT /api/project/{projectId}/phases/{phaseId}/tasks/{taskId}
     */
    updateTaskDates(
        projectId: number,
        phaseId: number,
        taskId: number,
        startDate: string,
        endDate: string
    ): Observable<any> {
        return this.http.put(
            `${this.api}/${projectId}/phases/${phaseId}/tasks/${taskId}`,
            {
                startDate,
                endDate
            }
        );
    }

    /**
     * Parse date string from backend (dd-mm-yyyy) to Date object
     */
    parseDate(dateString: string | undefined): Date | null {
        if (!dateString) return null;

        // First, try dd-mm-yyyy format (our expected format)
        const parts = dateString.split('-');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
            const year = parseInt(parts[2], 10);

            // Validate that we have reasonable values
            if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && year >= 1900) {
                const parsed = new Date(year, month, day);
                if (!isNaN(parsed.getTime())) {
                    return parsed;
                }
            }
        }

        // Fallback: Try ISO format (yyyy-mm-dd)
        const isoDate = new Date(dateString);
        if (!isNaN(isoDate.getTime())) {
            return isoDate;
        }

        console.error('Failed to parse date:', dateString);
        return null;
    }

    /**
     * Format Date object or date string to yyyy-mm-dd for API
     */
    formatDateForAPI(date: Date | string): string {
        let dateObj: Date;

        if (typeof date === 'string') {
            const parsed = this.parseDate(date);
            if (!parsed) {
                console.error('Failed to parse date for API formatting:', date);
                return '';
            }
            dateObj = parsed;
        } else {
            dateObj = date;
        }

        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Format date for display (e.g., "Dec 3, 2025")
     */
    formatDateForDisplay(dateString: string | undefined): string {
        const date = this.parseDate(dateString);
        if (!date) return 'Invalid Date';

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    }

    /**
     * Format date for short display (e.g., "Dec 3")
     */
    formatDateShort(dateString: string | undefined): string {
        const date = this.parseDate(dateString);
        if (!date) return '';

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[date.getMonth()]} ${date.getDate()}`;
    }
}
