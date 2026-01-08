import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { ProjectMember } from '../models/project.model';

@Injectable({
    providedIn: 'root'
})
export class PermissionService {
    private authService = inject(AuthService);

    /**
     * Get the current user's project role
     */
    getCurrentUserProjectRole(projectMembers: ProjectMember[], currentUserId: number | null): string | null {
        if (!currentUserId || !projectMembers) return null;
        const member = projectMembers.find(m => m.userId === currentUserId);
        return member?.role?.toUpperCase() || null;
    }

    /**
     * Check if user can create or update phases
     * Allowed: SUPER_ADMIN (global) or SUPER_ADMIN/PROJECT_HEAD (project)
     */
    canCreateOrUpdatePhase(projectMembers: ProjectMember[], currentUserId: number | null): boolean {
        // Global SUPER_ADMIN can always create/update
        if (this.authService.isSuperAdmin()) {
            return true;
        }

        // Check project role
        const projectRole = this.getCurrentUserProjectRole(projectMembers, currentUserId);
        return projectRole === 'SUPER_ADMIN' || projectRole === 'PROJECT_HEAD';
    }

    /**
     * Check if user can delete phases
     * Allowed: SUPER_ADMIN (global) or SUPER_ADMIN (project) only
     */
    canDeletePhase(projectMembers: ProjectMember[], currentUserId: number | null): boolean {
        // Global SUPER_ADMIN can always delete
        if (this.authService.isSuperAdmin()) {
            return true;
        }

        // Only project SUPER_ADMIN can delete
        const projectRole = this.getCurrentUserProjectRole(projectMembers, currentUserId);
        return projectRole === 'SUPER_ADMIN';
    }

    /**
     * Check if user can create or update tasks
     * Allowed: SUPER_ADMIN (global) or any project member except PROJECT_VIEWER
     */
    canCreateOrUpdateTask(projectMembers: ProjectMember[], currentUserId: number | null): boolean {
        // Global SUPER_ADMIN can always create/update
        if (this.authService.isSuperAdmin()) {
            return true;
        }

        // Check project role - all except PROJECT_VIEWER
        const projectRole = this.getCurrentUserProjectRole(projectMembers, currentUserId);
        return projectRole !== null && projectRole !== 'PROJECT_VIEWER';
    }

    /**
     * Check if user can delete tasks
     * Allowed: SUPER_ADMIN (global) or any project member except PROJECT_VIEWER and PROJECT_HANDLER
     */
    canDeleteTask(projectMembers: ProjectMember[], currentUserId: number | null): boolean {
        // Global SUPER_ADMIN can always delete
        if (this.authService.isSuperAdmin()) {
            return true;
        }

        // Check project role - all except PROJECT_VIEWER and PROJECT_HANDLER
        const projectRole = this.getCurrentUserProjectRole(projectMembers, currentUserId);
        return projectRole !== null &&
            projectRole !== 'PROJECT_VIEWER' &&
            projectRole !== 'PROJECT_HANDLER';
    }

    /**
     * Alias methods for clarity
     */
    canCreatePhase = this.canCreateOrUpdatePhase.bind(this);
    canUpdatePhase = this.canCreateOrUpdatePhase.bind(this);
    canCreateTask = this.canCreateOrUpdateTask.bind(this);
    canUpdateTask = this.canCreateOrUpdateTask.bind(this);

    /**
     * Subtasks follow the same rules as tasks
     */
    canCreateSubtask = this.canCreateOrUpdateTask.bind(this);
    canUpdateSubtask = this.canCreateOrUpdateTask.bind(this);
    canDeleteSubtask = this.canDeleteTask.bind(this);
}
