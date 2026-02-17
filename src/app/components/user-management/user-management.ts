import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, ViewContainerRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserManagementService, User } from '../../services/user-management.service';
import { Overlay, OverlayModule, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { InviteUserModalComponent } from '../invite-user-modal/invite-user-modal';
import { UserDetailsModalComponent } from './user-details-modal/user-details-modal';

type SortOrder = 'asc' | 'desc';
type SortColumn = 'userId' | 'name' | 'email' | 'role' | 'createdAt';

@Component({
    selector: 'app-user-management',
    imports: [CommonModule, OverlayModule, InviteUserModalComponent, UserDetailsModalComponent],
    templateUrl: './user-management.html',
    styleUrl: './user-management.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserManagementComponent {
    private userManagementService = inject(UserManagementService);
    private overlay = inject(Overlay);
    private viewContainerRef = inject(ViewContainerRef);

    // Modal state
    showInviteUserModal = signal(false);

    // User details modal state
    showUserDetailsModal = signal(false);
    selectedUser = signal<User | null>(null);

    // Pagination & Filtering
    searchQuery = signal('');
    selectedRoleFilter = signal('');
    itemsPerPage = signal(10);
    currentPage = signal(0);

    // Sorting
    sortBy = signal<SortColumn>('createdAt');
    sortOrder = signal<SortOrder>('desc');

    // Data
    users = signal<User[]>([]);
    totalPages = signal(0);
    totalElements = signal(0);

    // Role editing
    editingRoleUserId = signal<number | null>(null);

    // Row-level menu state
    hoveredUserId = signal<number | null>(null);
    openMenuUserId = signal<number | null>(null);
    showRoleSubmenu = signal(false);
    private overlayRef: OverlayRef | null = null;

    // Available roles
    availableRoles = ['SUPER ADMIN', 'ADMIN', 'MEMBER'];

    constructor() {
        // Load users on init
        this.loadUsers();

        // Reload when filters change
        effect(() => {
            // Track dependencies
            this.searchQuery();
            this.selectedRoleFilter();
            this.itemsPerPage();
            this.currentPage();
            this.sortBy();
            this.sortOrder();

            // Reload users
            this.loadUsers();
        }, { allowSignalWrites: true });
    }

    loadUsers(): void {
        const search = this.searchQuery();
        const roleFilter = this.selectedRoleFilter();

        // Map role filter to match API format
        const searchParam = search || (roleFilter ? roleFilter.replace('_', ' ') : '');

        this.userManagementService.getUsers(
            this.currentPage(),
            this.itemsPerPage(),
            this.sortBy(),
            this.sortOrder(),
            searchParam
        ).subscribe({
            next: (response) => {
                // Filter to show only active users
                const activeUsers = response.content.filter(user => user.isActive);
                this.users.set(activeUsers);
                this.totalPages.set(response.totalPages);
                this.totalElements.set(response.totalElements);
            },
            error: (error) => {
                console.error('Error loading users:', error);
            }
        });
    }

    onSearchChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        this.searchQuery.set(input.value);
        this.currentPage.set(0); // Reset to first page
    }

    onRoleFilterChange(event: Event): void {
        const select = event.target as HTMLSelectElement;
        this.selectedRoleFilter.set(select.value);
        this.currentPage.set(0); // Reset to first page
    }

    onItemsPerPageChange(event: Event): void {
        const select = event.target as HTMLSelectElement;
        this.itemsPerPage.set(Number(select.value));
        this.currentPage.set(0); // Reset to first page
    }

    toggleSort(column: SortColumn): void {
        if (this.sortBy() === column) {
            // Toggle order
            this.sortOrder.set(this.sortOrder() === 'asc' ? 'desc' : 'asc');
        } else {
            // New column, default to asc
            this.sortBy.set(column);
            this.sortOrder.set('asc');
        }
    }

    getSortIcon(column: SortColumn): string {
        if (this.sortBy() !== column) {
            return 'sort'; // Default icon
        }
        return this.sortOrder() === 'asc' ? 'sort-asc' : 'sort-desc';
    }

    isSortedBy(column: SortColumn): boolean {
        return this.sortBy() === column;
    }

    previousPage(): void {
        if (this.currentPage() > 0) {
            this.currentPage.update(p => p - 1);
        }
    }

    nextPage(): void {
        if (this.currentPage() < this.totalPages() - 1) {
            this.currentPage.update(p => p + 1);
        }
    }

    goToPage(page: number): void {
        this.currentPage.set(page);
    }

    // Role editing methods
    startEditingRole(userId: number): void {
        this.editingRoleUserId.set(userId);
    }

    stopEditingRole(): void {
        this.editingRoleUserId.set(null);
    }

    isEditingRole(userId: number): boolean {
        return this.editingRoleUserId() === userId;
    }

    getAvailableRolesForUser(currentRole: string): string[] {
        return this.availableRoles.filter(role => role !== currentRole);
    }

    changeRole(userId: number, newRole: string): void {
        this.userManagementService.changeUserRole(userId, newRole).subscribe({
            next: () => {
                // Update the user in the list
                this.users.update(users =>
                    users.map(user =>
                        user.userId === userId
                            ? { ...user, role: { roleName: newRole } }
                            : user
                    )
                );
                this.stopEditingRole();
            },
            error: (error) => {
                console.error('Error changing user role:', error);
                this.stopEditingRole();
            }
        });
    }

    getRoleDisplayText(role: string): string {
        return role; // Already in correct format from API
    }

    getRoleColorClass(role: string): string {
        const colorMap: Record<string, string> = {
            'SUPER ADMIN': 'bg-purple-100 text-purple-800',
            'ADMIN': 'bg-blue-100 text-blue-800',
            'MEMBER': 'bg-gray-100 text-gray-800'
        };
        return colorMap[role] || 'bg-gray-100 text-gray-800';
    }

    getInitials(name: string): string {
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
        }
        return name.charAt(0).toUpperCase();
    }

    getAvatarGradient(index: number): string {
        const gradients = [
            'from-purple-500 to-pink-500',
            'from-blue-500 to-cyan-500',
            'from-green-500 to-teal-500',
            'from-orange-500 to-red-500',
            'from-pink-500 to-rose-500'
        ];
        return gradients[index % gradients.length];
    }

    // Pagination helpers
    get startIndex(): number {
        return this.currentPage() * this.itemsPerPage() + 1;
    }

    get endIndex(): number {
        const end = (this.currentPage() + 1) * this.itemsPerPage();
        return Math.min(end, this.totalElements());
    }

    getPageNumbers(): number[] {
        const total = this.totalPages();
        const current = this.currentPage();
        const pages: number[] = [];

        // Show max 5 page numbers
        let start = Math.max(0, current - 2);
        let end = Math.min(total - 1, start + 4);

        // Adjust start if we're near the end
        if (end - start < 4) {
            start = Math.max(0, end - 4);
        }

        for (let i = start; i <= end; i++) {
            pages.push(i);
        }

        return pages;
    }

    formatDate(dateStr: string): string {
        if (!dateStr) return '—';

        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            return '—';
        }
    }

    // Row-level menu methods using CDK Overlay
    setHoveredUser(userId: number | null): void {
        this.hoveredUserId.set(userId);
    }

    /**
     * Toggles the dropdown menu.
     * Uses cdkConnectedOverlay directive in template for:
     * 1. Rendering outside table DOM (no table reflow)
     * 2. Auto-flip positioning (top/bottom based on space)
     * 3. Proper z-index management
     * 4. Backdrop for outside click detection
     */
    toggleMenu(userId: number, event: Event): void {
        event.stopPropagation();

        if (this.openMenuUserId() === userId) {
            this.closeMenu();
        } else {
            this.openMenuUserId.set(userId);
            this.showRoleSubmenu.set(false);
        }
    }

    closeMenu(): void {
        this.openMenuUserId.set(null);
        this.showRoleSubmenu.set(false);
    }

    isMenuOpen(userId: number): boolean {
        return this.openMenuUserId() === userId;
    }

    changeRoleViaMenu(userId: number, newRole: string): void {
        this.changeRole(userId, newRole);
        this.closeMenu();
    }

    deleteUser(userId: number): void {
        if (!confirm('Are you sure you want to remove this user? This action cannot be undone.')) {
            return;
        }

        this.userManagementService.deleteUser(userId).subscribe({
            next: () => {
                // Remove user from the list
                this.users.update(users => users.filter(user => user.userId !== userId));
                this.totalElements.update(total => total - 1);
                this.closeMenu();
            },
            error: (error) => {
                console.error('Error deleting user:', error);
                alert('Failed to delete user. Please try again.');
                this.closeMenu();
            }
        });
    }

    // Invite User Modal methods
    openInviteUserModal(): void {
        this.showInviteUserModal.set(true);
    }

    closeInviteUserModal(): void {
        this.showInviteUserModal.set(false);
    }

    onUsersInvited(): void {
        this.loadUsers();
    }

    // User details modal methods
    onUserRowClick(user: User): void {
        this.selectedUser.set(user);
        this.showUserDetailsModal.set(true);
    }

    closeUserDetailsModal(): void {
        this.showUserDetailsModal.set(false);
        this.selectedUser.set(null);
    }
}
