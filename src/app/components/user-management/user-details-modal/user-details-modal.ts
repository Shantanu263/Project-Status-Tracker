import { Component, input, output, signal, effect, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy } from '@angular/core';
import { User, UserManagementService } from '../../../services/user-management.service';

@Component({
    selector: 'app-user-details-modal',
    imports: [CommonModule],
    templateUrl: './user-details-modal.html',
    styleUrl: './user-details-modal.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserDetailsModalComponent {
    private userManagementService = inject(UserManagementService);

    // Inputs
    isOpen = input.required<boolean>();
    userId = input.required<number>();
    user = input.required<User>();

    // Outputs
    close = output<void>();

    // State
    loading = signal(false);
    error = signal<string | null>(null);
    projectMemberships = signal<any[]>([]);

    constructor() {
        effect(() => {
            const id = this.userId();
            const isOpenState = this.isOpen();

            if (id && isOpenState) {
                this.loadUserProjects();
            }
        }, { allowSignalWrites: true });
    }

    loadUserProjects(): void {
        this.loading.set(true);
        this.error.set(null);

        this.userManagementService.getUserProjectMemberships(this.userId()).subscribe({
            next: (memberships) => {
                this.projectMemberships.set(memberships);
                this.loading.set(false);
            },
            error: (err) => {
                console.error('Error loading user projects:', err);
                this.error.set('Failed to load user projects');
                this.loading.set(false);
            }
        });
    }

    onClose(): void {
        this.close.emit();
    }

    getInitials(name?: string): string {
        if (!name) return 'NA';
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
        }
        return name.charAt(0).toUpperCase();
    }

    getAvatarColor(userId: number): string {
        const colors = [
            'from-purple-500 to-pink-500',
            'from-blue-500 to-cyan-500',
            'from-green-500 to-teal-500',
            'from-orange-500 to-red-500',
            'from-pink-500 to-rose-500'
        ];
        const index = userId % colors.length;
        return `bg-gradient-to-br ${colors[index]}`;
    }

    getGlobalRoleColorClass(role: string): string {
        const colorMap: { [key: string]: string } = {
            'SUPER ADMIN': 'bg-purple-100 text-purple-800',
            'ADMIN': 'bg-blue-100 text-blue-800',
            'MEMBER': 'bg-gray-100 text-gray-800'
        };
        return colorMap[role] || 'bg-gray-100 text-gray-800';
    }

    getProjectRoleColorClass(role: string): string {
        const colorMap: { [key: string]: string } = {
            'SUPER_ADMIN': 'bg-purple-100 text-purple-800',
            'PROJECT_HEAD': 'bg-[#8c2d1b] text-white',
            'PROJECT_HANDLER': 'bg-blue-100 text-blue-700',
            'PROJECT_VIEWER': 'bg-gray-100 text-gray-700'
        };
        return colorMap[role.toUpperCase().replace(' ', '_')] || 'bg-gray-100 text-gray-700';
    }

    getProjectRoleLabel(role: string): string {
        const roleMap: { [key: string]: string } = {
            'SUPER_ADMIN': 'Super Admin',
            'PROJECT_HEAD': 'Head',
            'PROJECT_HANDLER': 'Handler',
            'PROJECT_VIEWER': 'Viewer'
        };
        return roleMap[role.toUpperCase().replace(' ', '_')] || role;
    }

    formatDate(dateString: string | undefined): string {
        if (!dateString) return 'N/A';

        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            return dateString;
        }
    }
}
