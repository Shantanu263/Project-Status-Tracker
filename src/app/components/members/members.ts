import { ChangeDetectionStrategy, Component, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { SelectedProjectService } from '../../services/selected-project.service';

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
  project: string;
  role: string;
  email: string;
  assignedBy: AssignedBy;
  memberStatus: string;
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
  imports: [CommonModule, FormsModule],
  templateUrl: './members.html',
  styleUrl: './members.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MembersComponent {
  private readonly http = inject(HttpClient);
  private readonly selectedProjectService = inject(SelectedProjectService);

  members = signal<ProjectMember[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  // Pagination
  currentPage = signal(0);
  pageSize = signal(5);
  totalPages = signal(0);
  totalItems = signal(0);

  // Sorting & Filtering
  sortBy = signal<'user.name' | 'user.role' | 'user.email'>('user.name');
  order = signal<'asc' | 'desc'>('asc');
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

  Math = Math;
}
