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
     * Get allowed roles that current user can assign when adding/changing members
     * Rules:
     * - SUPER_ADMIN (global/project): Can assign all roles
     * - PROJECT_HEAD: Cannot assign SUPER_ADMIN
     * - PROJECT_HANDLER: Cannot assign SUPER_ADMIN or PROJECT_HEAD
     * - PROJECT_VIEWER: Can ONLY assign PROJECT_VIEWER
     */
    getAllowedRolesToAdd(projectMembers: ProjectMember[], currentUserId: number | null): string[] {
        const allRoles = ['SUPER_ADMIN', 'PROJECT_HEAD', 'PROJECT_HANDLER', 'PROJECT_VIEWER'];

        // Global SUPER_ADMIN can assign all roles
        if (this.authService.isSuperAdmin()) {
            return allRoles;
        }

        const projectRole = this.getCurrentUserProjectRole(projectMembers, currentUserId);

        switch (projectRole) {
            case 'SUPER_ADMIN':
                return allRoles; // Can assign all roles
            case 'PROJECT_HEAD':
                return ['PROJECT_HEAD', 'PROJECT_HANDLER', 'PROJECT_VIEWER']; // Cannot assign SUPER_ADMIN
            case 'PROJECT_HANDLER':
                return ['PROJECT_HANDLER', 'PROJECT_VIEWER']; // Cannot assign SUPER_ADMIN or PROJECT_HEAD
            case 'PROJECT_VIEWER':
                return ['PROJECT_VIEWER']; // Can ONLY assign PROJECT_VIEWER
            default:
                return []; // No permission
        }
    }

    /**
     * Check if user can update phase timeline (drag/resize in timeline component)
     * Allowed: SUPER_ADMIN (global) or SUPER_ADMIN/PROJECT_HEAD (project)
     */
    canUpdatePhaseTimeline(projectMembers: ProjectMember[], currentUserId: number | null): boolean {
        // Global SUPER_ADMIN can always update
        if (this.authService.isSuperAdmin()) {
            return true;
        }

        // Check project role - only SUPER_ADMIN and PROJECT_HEAD
        const projectRole = this.getCurrentUserProjectRole(projectMembers, currentUserId);
        return projectRole === 'SUPER_ADMIN' || projectRole === 'PROJECT_HEAD';
    }

    /**
     * Check if user can update task timeline (drag/resize in timeline component)
     * Allowed: SUPER_ADMIN (global) or any project member except PROJECT_VIEWER
     */
    canUpdateTaskTimeline(projectMembers: ProjectMember[], currentUserId: number | null): boolean {
        // Same rules as canUpdateTask
        return this.canCreateOrUpdateTask(projectMembers, currentUserId);
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
