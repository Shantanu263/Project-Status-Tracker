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
import { PhaseDependency } from '../models/timeline.model';

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
     * Parse date string from backend (dd-mm-yyyy) or API format (yyyy-mm-dd) to Date object.
     * IMPORTANT: Always creates dates in LOCAL timezone at midnight to ensure
     * consistent comparisons with column dates throughout the timeline.
     */
    parseDate(dateString: string | undefined): Date | null {
        if (!dateString) return null;

        const parts = dateString.split('-');
        if (parts.length === 3) {
            const p0 = parseInt(parts[0], 10);
            const p1 = parseInt(parts[1], 10);
            const p2 = parseInt(parts[2], 10);

            // Try yyyy-mm-dd format (ISO / API format) — check first part > 31 to distinguish from dd-mm-yyyy
            if (p0 > 31 && p1 >= 1 && p1 <= 12 && p2 >= 1 && p2 <= 31) {
                const parsed = new Date(p0, p1 - 1, p2); // Local midnight
                if (!isNaN(parsed.getTime())) {
                    return parsed;
                }
            }

            // Try dd-mm-yyyy format (backend format)
            if (p0 >= 1 && p0 <= 31 && p1 >= 1 && p1 <= 12 && p2 >= 1900) {
                const parsed = new Date(p2, p1 - 1, p0); // Local midnight
                if (!isNaN(parsed.getTime())) {
                    return parsed;
                }
            }
        }

        // Last resort fallback: normalize to local midnight to avoid UTC vs local issues
        const fallbackDate = new Date(dateString);
        if (!isNaN(fallbackDate.getTime())) {
            // Normalize to local midnight to prevent timezone-related positioning bugs
            return new Date(fallbackDate.getFullYear(), fallbackDate.getMonth(), fallbackDate.getDate());
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

    /**
     * Fetch all phase dependencies for a project
     * GET /api/project/{projectId}/phases/dependency
     */
    getDependencies(projectId: number): Observable<PhaseDependency[]> {
        return this.http.get<PhaseDependency[]>(`${this.api}/${projectId}/phases/dependency`);
    }

    /**
     * Create a phase dependency
     * POST /api/project/{projectId}/phases/dependency
     */
    createDependency(projectId: number, dep: { predecessorId: number; successorId: number; dependencyType?: string }): Observable<PhaseDependency> {
        return this.http.post<PhaseDependency>(`${this.api}/${projectId}/phases/dependency`, dep);
    }

    /**
     * Delete a phase dependency
     * DELETE /api/project/{projectId}/phases/dependency/{dependencyId}
     */
    deleteDependency(projectId: number, dependencyId: number): Observable<void> {
        return this.http.delete<void>(`${this.api}/${projectId}/phases/dependency/${dependencyId}`);
    }
}
