import { Injectable } from '@angular/core';

/**
 * Service to manage project-specific UI state across components.
 * Uses sessionStorage for persistence within the user's session.
 * State is automatically cleared when:
 * - Browser tab/window is closed
 * - User logs out
 */
@Injectable({
    providedIn: 'root'
})
export class ProjectStateService {
    private readonly STORAGE_PREFIX = 'project_';
    private readonly PHASE_SUFFIX = '_selectedPhase';

    /**
     * Get the selected phase ID for a project
     * @param projectId The project ID
     * @returns The selected phase ID or null if not set
     */
    getSelectedPhaseId(projectId: number): number | null {
        try {
            const key = this.getPhaseKey(projectId);
            const value = sessionStorage.getItem(key);

            if (!value) return null;

            const phaseId = parseInt(value, 10);
            return isNaN(phaseId) ? null : phaseId;
        } catch (error) {
            console.error('Error reading selected phase from sessionStorage:', error);
            return null;
        }
    }

    /**
     * Set the selected phase ID for a project
     * @param projectId The project ID
     * @param phaseId The phase ID to store
     */
    setSelectedPhaseId(projectId: number, phaseId: number): void {
        try {
            const key = this.getPhaseKey(projectId);
            sessionStorage.setItem(key, phaseId.toString());
        } catch (error) {
            console.error('Error saving selected phase to sessionStorage:', error);
        }
    }

    /**
     * Clear the selected phase for a specific project
     * @param projectId The project ID
     */
    clearSelectedPhase(projectId: number): void {
        try {
            const key = this.getPhaseKey(projectId);
            sessionStorage.removeItem(key);
        } catch (error) {
            console.error('Error clearing selected phase from sessionStorage:', error);
        }
    }

    /**
     * Clear all project-specific UI state
     * Should be called on logout to ensure clean state
     */
    clearAllProjectState(): void {
        try {
            // Get all keys from sessionStorage
            const keys = Object.keys(sessionStorage);

            // Remove all keys that start with our prefix
            keys.forEach(key => {
                if (key.startsWith(this.STORAGE_PREFIX)) {
                    sessionStorage.removeItem(key);
                }
            });
        } catch (error) {
            console.error('Error clearing all project state from sessionStorage:', error);
        }
    }

    /**
     * Generate the storage key for a project's selected phase
     * @param projectId The project ID
     * @returns The storage key
     */
    private getPhaseKey(projectId: number): string {
        return `${this.STORAGE_PREFIX}${projectId}${this.PHASE_SUFFIX}`;
    }
}
