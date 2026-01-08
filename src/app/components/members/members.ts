import { ChangeDetectionStrategy, Component, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { SelectedProjectService } from '../../services/selected-project.service';
import { AddMembersModalComponent } from '../add-members-modal/add-members-modal';
import { AuthService } from '../../services/auth.service';

interface AssignedBy {
  userId: number;
  name: string;
  email: string;
  role: {
    roleName: string;
  };
}

interface ProjectMember {
  memberId: string;
  user: string;
  userId: number;
  project: string;
  role: string;
  email: string;
  assignedBy: AssignedBy;
  memberStatus: string;
  globalRole?: string;
}

interface MembersResponse {
  totalItems: number;
  isLast: boolean;
  totalPages: number;
  pageSize: number;
  currentPage: number;
  items: ProjectMember[];
}

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [CommonModule, FormsModule, AddMembersModalComponent],
  templateUrl: './members.html',
  styleUrl: './members.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MembersComponent {
  private readonly http = inject(HttpClient);
  private readonly selectedProjectService = inject(SelectedProjectService);
  private readonly authService = inject(AuthService);

  members = signal<ProjectMember[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  showAddMembersModal = signal(false);

  // Role editing
  editingRoleMemberId = signal<string | null>(null);

  // Pagination
  currentPage = signal(0);
  pageSize = signal(5);
  totalPages = signal(0);
  totalItems = signal(0);

  // Sorting & Filtering
  sortBy = signal<'memberId' | 'user.name' | 'user.role' | 'user.email'>('user.name');
  order = signal<'asc' | 'desc'>('asc');
  sortOrder = signal<'asc' | 'desc'>('asc');
  searchQuery = signal('');

  sortOptions = [
    { label: 'Name', value: 'user.name' },
    { label: 'Role', value: 'user.role' },
    { label: 'Email', value: 'user.email' }
  ] as const;

  orderOptions = [
    { label: 'Ascending', value: 'asc' },
    { label: 'Descending', value: 'desc' }
  ] as const;

  selectedProject = computed(() => this.selectedProjectService.getSelectedProject()());

  // Get current user's project role
  currentUserProjectRole = computed(() => {
    const currentUserId = this.authService.getCurrentUserId();
    if (!currentUserId) return null;

    const currentMember = this.members().find(m => m.userId === currentUserId);
    return currentMember?.role || null;
  });

  filteredMembers = computed(() => {
    const query = this.searchQuery().toLowerCase();
    if (!query) return this.members();
    return this.members().filter(member =>
      member.user.toLowerCase().includes(query) ||
      member.role.toLowerCase().includes(query) ||
      member.assignedBy.name.toLowerCase().includes(query)
    );
  });

  constructor() {
    effect(() => {
      const project = this.selectedProject();
      if (!project) {
        this.members.set([]);
        this.totalPages.set(0);
        this.totalItems.set(0);
        this.error.set(null);
        return;
      }

      this.currentPage.set(0);
      this.loadMembers();
    }, { allowSignalWrites: true });
  }

  loadMembers(): void {
    const project = this.selectedProject();
    if (!project) {
      this.error.set('No project selected');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const url = `${environment.apiUrl}/project/${project.projectId}/get-project-members`;
    const params = {
      page: this.currentPage().toString(),
      size: this.pageSize().toString(),
      sortBy: this.sortBy(),
      order: this.order()
    };

    this.http.get<MembersResponse>(url, { params }).subscribe({
      next: (response) => {
        this.members.set(response.items);
        this.totalPages.set(response.totalPages);
        this.totalItems.set(response.totalItems);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load members');
        this.loading.set(false);
        console.error('Error loading members:', err);
      }
    });
  }

  onSearch(query: string): void {
    this.searchQuery.set(query);
  }

  onSortChange(sortBy: string): void {
    this.sortBy.set(sortBy as 'user.name' | 'user.role' | 'user.email');
    this.currentPage.set(0);
    this.loadMembers();
  }

  onOrderChange(order: string): void {
    this.order.set(order as 'asc' | 'desc');
    this.currentPage.set(0);
    this.loadMembers();
  }

  onPageSizeChange(pageSize: string): void {
    this.pageSize.set(parseInt(pageSize, 10));
    this.currentPage.set(0);
    this.loadMembers();
  }

  goToFirstPage(): void {
    this.currentPage.set(0);
    this.loadMembers();
  }

  goToPreviousPage(): void {
    if (this.currentPage() > 0) {
      this.currentPage.update(p => p - 1);
      this.loadMembers();
    }
  }

  goToNextPage(): void {
    if (this.currentPage() < this.totalPages() - 1) {
      this.currentPage.update(p => p + 1);
      this.loadMembers();
    }
  }

  goToLastPage(): void {
    this.currentPage.set(this.totalPages() - 1);
    this.loadMembers();
  }

  getRoleColor(role: string): string {
    const roleColorMap: Record<string, string> = {
      'PROJECT_HEAD': 'bg-[#8c2d1b] text-white',
      'PROJECT_HANDLER': 'bg-blue-100 text-blue-700',
      'PROJECT_VIEWER': 'bg-gray-100 text-gray-700'
    };
    return roleColorMap[role] || 'bg-gray-100 text-gray-700';
  }

  getRoleBadgeText(role: string): string {
    const roleTextMap: Record<string, string> = {
      'PROJECT_HEAD': 'Head',
      'PROJECT_HANDLER': 'Handler',
      'PROJECT_VIEWER': 'Viewer'
    };
    return roleTextMap[role] || role;
  }

  getStatusColor(status: string): string {
    return status === 'ACTIVE' ? 'text-green-600 bg-green-50' : 'text-gray-600 bg-gray-50';
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  getAvatarColor(memberId: string): string {
    const colors = [
      'from-indigo-500 to-purple-600',
      'from-blue-500 to-cyan-600',
      'from-pink-500 to-rose-600',
      'from-green-500 to-teal-600',
      'from-orange-500 to-red-600'
    ];
    const index = parseInt(memberId) % colors.length;
    return colors[index];
  }

  getAvatarGradient(index: number): string {
    const gradients = [
      'from-indigo-500 to-purple-600',
      'from-blue-500 to-cyan-600',
      'from-pink-500 to-rose-600',
      'from-green-500 to-teal-600',
      'from-orange-500 to-red-600',
      'from-yellow-500 to-orange-600',
      'from-emerald-500 to-teal-600'
    ];
    return gradients[index % gradients.length];
  }

  getRoleColorClass(role: string): string {
    const roleColorMap: Record<string, string> = {
      'PROJECT_HEAD': 'bg-[#8c2d1b] text-white',
      'PROJECT_HANDLER': 'bg-blue-100 text-blue-700',
      'PROJECT_VIEWER': 'bg-gray-100 text-gray-700'
    };
    return roleColorMap[role] || 'bg-gray-100 text-gray-700';
  }

  toggleSort(field: 'memberId' | 'user.name' | 'user.role' | 'user.email'): void {
    if (this.sortBy() === field) {
      // Toggle order if same field
      const newOrder = this.order() === 'asc' ? 'desc' : 'asc';
      this.order.set(newOrder);
      this.sortOrder.set(newOrder);
    } else {
      // Set new field and default to ascending
      this.sortBy.set(field);
      this.order.set('asc');
      this.sortOrder.set('asc');
    }
    this.currentPage.set(0);
    this.loadMembers();
  }

  isSortedBy(field: string): boolean {
    return this.sortBy() === field;
  }

  get startIndex(): number {
    return this.currentPage() * this.pageSize() + 1;
  }

  get endIndex(): number {
    return Math.min((this.currentPage() + 1) * this.pageSize(), this.totalItems());
  }

  previousPage(): void {
    if (this.currentPage() > 0) {
      this.currentPage.update(p => p - 1);
      this.loadMembers();
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages() - 1) {
      this.currentPage.update(p => p + 1);
      this.loadMembers();
    }
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.loadMembers();
  }

  getPageNumbers(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];

    if (total <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 0; i < total; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(0);

      if (current <= 3) {
        // Near the beginning
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push(total - 1);
      } else if (current >= total - 4) {
        // Near the end
        for (let i = total - 6; i < total - 1; i++) {
          pages.push(i);
        }
        pages.push(total - 1);
      } else {
        // In the middle
        for (let i = current - 2; i <= current + 2; i++) {
          pages.push(i);
        }
        pages.push(total - 1);
      }
    }

    return pages;
  }

  Math = Math;


  openAddMembersModal(): void {
    this.showAddMembersModal.set(true);
  }

  closeAddMembersModal(): void {
    this.showAddMembersModal.set(false);
  }

  onMembersAdded(): void {
    this.showAddMembersModal.set(false);
    this.loadMembers();
  }

  // Role management methods
  startEditingRole(memberId: string): void {
    this.editingRoleMemberId.set(memberId);
  }

  stopEditingRole(): void {
    this.editingRoleMemberId.set(null);
  }

  isEditingRole(memberId: string): boolean {
    return this.editingRoleMemberId() === memberId;
  }

  canEditMemberRole(member: ProjectMember): boolean {
    const currentUserGlobalRole = this.authService.getUserRole();
    const currentUserProjectRole = this.currentUserProjectRole();

    // Global SUPER_ADMIN can edit anyone
    if (currentUserGlobalRole?.toUpperCase().replace(' ', '_') === 'SUPER_ADMIN') {
      return true;
    }

    // Project SUPER_ADMIN can edit anyone
    if (currentUserProjectRole?.toUpperCase().replace(' ', '_') === 'SUPER_ADMIN') {
      return true;
    }

    // PROJECT_HEAD restrictions
    if (currentUserProjectRole?.toUpperCase().replace(' ', '_') === 'PROJECT_HEAD') {
      // Cannot edit members with global role PROJECT_ADMIN or project role SUPER_ADMIN
      const memberGlobalRole = member.globalRole?.toUpperCase().replace(' ', '_');
      const memberProjectRole = member.role?.toUpperCase().replace(' ', '_');

      if (memberGlobalRole === 'PROJECT_ADMIN' || memberProjectRole === 'SUPER_ADMIN') {
        return false;
      }
      return true;
    }

    // PROJECT_HANDLER restrictions
    if (currentUserProjectRole?.toUpperCase().replace(' ', '_') === 'PROJECT_HANDLER') {
      // Cannot edit members with global role PROJECT_ADMIN, project role SUPER_ADMIN or PROJECT_HEAD
      const memberGlobalRole = member.globalRole?.toUpperCase().replace(' ', '_');
      const memberProjectRole = member.role?.toUpperCase().replace(' ', '_');

      if (memberGlobalRole === 'PROJECT_ADMIN' ||
        memberProjectRole === 'SUPER_ADMIN' ||
        memberProjectRole === 'PROJECT_HEAD') {
        return false;
      }
      return true;
    }

    // PROJECT_VIEWER cannot edit anyone
    return false;
  }

  getAvailableProjectRoles(memberGlobalRole: string | undefined, memberProjectRole: string): string[] {
    const currentUserGlobalRole = this.authService.getUserRole();
    const currentUserProjectRole = this.currentUserProjectRole();
    const allRoles = ['SUPER_ADMIN', 'PROJECT_HEAD', 'PROJECT_HANDLER', 'PROJECT_VIEWER'];

    // Global SUPER_ADMIN or Project SUPER_ADMIN can assign all roles
    if (currentUserGlobalRole?.toUpperCase().replace(' ', '_') === 'SUPER_ADMIN' ||
      currentUserProjectRole?.toUpperCase().replace(' ', '_') === 'SUPER_ADMIN') {
      return allRoles.filter(role => role !== memberProjectRole.toUpperCase().replace(' ', '_'));
    }

    // PROJECT_HEAD cannot assign SUPER_ADMIN
    if (currentUserProjectRole?.toUpperCase().replace(' ', '_') === 'PROJECT_HEAD') {
      return allRoles
        .filter(role => role !== 'SUPER_ADMIN')
        .filter(role => role !== memberProjectRole.toUpperCase().replace(' ', '_'));
    }

    // PROJECT_HANDLER cannot assign SUPER_ADMIN or PROJECT_HEAD
    if (currentUserProjectRole?.toUpperCase().replace(' ', '_') === 'PROJECT_HANDLER') {
      return allRoles
        .filter(role => role !== 'SUPER_ADMIN' && role !== 'PROJECT_HEAD')
        .filter(role => role !== memberProjectRole.toUpperCase().replace(' ', '_'));
    }

    return [];
  }

  changeProjectRole(memberId: string, newRole: string): void {
    const project = this.selectedProject();
    if (!project) return;

    const url = `${environment.apiUrl}/project/${project.projectId}/project-members/${memberId}/role`;
    const payload = { roleInProject: newRole };

    this.http.patch(url, payload).subscribe({
      next: () => {
        // Update the member in the list
        this.members.update(members =>
          members.map(member =>
            member.memberId === memberId
              ? { ...member, role: newRole }
              : member
          )
        );
        this.stopEditingRole();
      },
      error: (err) => {
        console.error('Error changing project role:', err);
        this.error.set('Failed to change project role');
        this.stopEditingRole();
      }
    });
  }

  getProjectRoleDisplayText(role: string): string {
    const roleMap: Record<string, string> = {
      'SUPER_ADMIN': 'Super Admin',
      'PROJECT_HEAD': 'Head',
      'PROJECT_HANDLER': 'Handler',
      'PROJECT_VIEWER': 'Viewer'
    };
    return roleMap[role.toUpperCase().replace(' ', '_')] || role;
  }

  getProjectRoleColorClass(role: string): string {
    const colorMap: Record<string, string> = {
      'SUPER_ADMIN': 'bg-purple-100 text-purple-800',
      'PROJECT_HEAD': 'bg-[#8c2d1b] text-white',
      'PROJECT_HANDLER': 'bg-blue-100 text-blue-700',
      'PROJECT_VIEWER': 'bg-gray-100 text-gray-700'
    };
    return colorMap[role.toUpperCase().replace(' ', '_')] || 'bg-gray-100 text-gray-700';
  }
}
