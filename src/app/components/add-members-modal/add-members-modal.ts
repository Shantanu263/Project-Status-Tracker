import { Component, input, output, signal, inject, ChangeDetectionStrategy, computed, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ProjectService } from '../../services/project.service';
import { PermissionService } from '../../services/permission.service';
import { AuthService } from '../../services/auth.service';
import { ProjectMember } from '../../models/project.model';
import { UserManagementService, User } from '../../services/user-management.service';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, switchMap, catchError, of } from 'rxjs';

interface MemberToAdd {
    email: string;
    role: string;
    initials: string;
    color: string;
}

@Component({
    selector: 'app-add-members-modal',
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './add-members-modal.html',
    styleUrl: './add-members-modal.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddMembersModalComponent implements OnInit, OnDestroy {
    private fb = inject(FormBuilder);
    private projectService = inject(ProjectService);
    private permissionService = inject(PermissionService);
    private authService = inject(AuthService);
    private userManagementService = inject(UserManagementService);

    // Input/Output
    isOpen = input.required<boolean>();
    projectId = input.required<number>();
    projectMembers = input<ProjectMember[]>([]);
    close = output<void>();
    membersAdded = output<void>();

    // State
    members = signal<MemberToAdd[]>([]);
    isLoading = signal(false);
    membersBeingAdded = signal(0);
    errorMessage = signal<string | null>(null);

    // Autocomplete state
    userSuggestions = signal<User[]>([]);
    showDropdown = signal(false);
    isSearchingUsers = signal(false);

    private destroy$ = new Subject<void>();
    private emailSearch$ = new Subject<string>();

    // Form
    memberForm: FormGroup;

    // Computed: allowed roles
    allowedRoles = computed(() => {
        const currentUserId = this.authService.getCurrentUserId();
        return this.permissionService.getAllowedRolesToAdd(this.projectMembers(), currentUserId);
    });

    constructor() {
        this.memberForm = this.fb.group({
            memberEmail: ['', [Validators.required, Validators.email]],
            memberRole: ['PROJECT_HANDLER', Validators.required]
        });
    }

    ngOnInit(): void {
        // Debounce email field changes → search registered users
        this.emailSearch$.pipe(
            debounceTime(300),
            // distinctUntilChanged() was causing the issue where re-typing the same character after backspace would not trigger a new search
            switchMap(query => this.userManagementService.getUsers(0, 8, 'name', 'asc', query).pipe(
                catchError(() => of(null))
            )),
            takeUntil(this.destroy$)
        ).subscribe(response => {
            if (response) {
                const existingEmails = new Set([
                    ...this.projectMembers().map(m => m.email),
                    ...this.members().map(m => m.email)
                ]);
                const filtered = response.content.filter(u => !existingEmails.has(u.email));
                this.userSuggestions.set(filtered);
                if (filtered.length === 0) {
                    this.showDropdown.set(false);
                }
            } else {
                this.userSuggestions.set([]);
                this.showDropdown.set(false);
            }
            this.isSearchingUsers.set(false);
        });

        // Hook into form control value changes
        this.memberForm.get('memberEmail')!.valueChanges
            .pipe(takeUntil(this.destroy$))
            .subscribe((value: string) => {
                const q = (value || '').trim();
                if (q.length >= 1) {
                    this.isSearchingUsers.set(true);
                    this.showDropdown.set(true);
                    this.emailSearch$.next(q);
                } else {
                    this.userSuggestions.set([]);
                    this.showDropdown.set(false);
                    this.isSearchingUsers.set(false);
                }
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    @HostListener('document:click')
    onDocumentClick(): void {
        this.showDropdown.set(false);
    }

    // ── Autocomplete ──────────────────────────────────────────────────────

    private searchUsers(query: string): void {
        // Method unused now, handled in switchMap directly
    }

    selectSuggestion(user: User, event: Event): void {
        event.stopPropagation();
        // Patch without triggering another search by temporarily unsubscribing via distinct
        this.memberForm.patchValue({ memberEmail: user.email });
        this.userSuggestions.set([]);
        this.showDropdown.set(false);
        this.errorMessage.set(null);
    }

    onEmailFieldClick(event: Event): void {
        event.stopPropagation();
        if (this.userSuggestions().length > 0) {
            this.showDropdown.set(true);
        }
    }

    getUserInitials(user: User): string {
        const parts = user.name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
        }
        return user.name.charAt(0).toUpperCase();
    }

    getUserAvatarGradient(index: number): string {
        const gradients = [
            'from-purple-500 to-pink-500',
            'from-blue-500 to-cyan-500',
            'from-green-500 to-teal-500',
            'from-orange-500 to-red-500',
            'from-pink-500 to-rose-500'
        ];
        return gradients[index % gradients.length];
    }

    getGlobalRoleColorClass(role: string): string {
        const colorMap: Record<string, string> = {
            'SUPER ADMIN': 'bg-purple-100 text-purple-800',
            'ADMIN': 'bg-blue-100 text-blue-800',
            'MEMBER': 'bg-gray-100 text-gray-800'
        };
        return colorMap[role] || 'bg-gray-100 text-gray-800';
    }

    // ── Staged members list ───────────────────────────────────────────────

    addMember(): void {
        if (this.memberForm.invalid) return;

        const email = this.memberForm.get('memberEmail')?.value?.trim();
        const role = this.memberForm.get('memberRole')?.value;

        if (this.members().some(m => m.email === email)) {
            this.errorMessage.set('This member has already been added');
            return;
        }

        const initials = email.split('@')[0].substring(0, 2).toUpperCase();
        const color = this.getAvatarGradient(this.members().length);

        this.members.update(members => [...members, { email, role, initials, color }]);
        this.memberForm.patchValue({ memberEmail: '' });
        this.userSuggestions.set([]);
        this.showDropdown.set(false);
        this.errorMessage.set(null);
    }

    removeMember(index: number): void {
        this.members.update(members => members.filter((_, i) => i !== index));
    }

    async finishAndAddMembers(): Promise<void> {
        const projectId = this.projectId();
        const membersToAdd = this.members();

        if (membersToAdd.length === 0) {
            this.onClose();
            return;
        }

        this.isLoading.set(true);
        this.errorMessage.set(null);
        this.membersBeingAdded.set(0);

        try {
            for (let i = 0; i < membersToAdd.length; i++) {
                const member = membersToAdd[i];
                await this.projectService.addMemberToProject(
                    projectId,
                    member.email,
                    member.role
                ).toPromise();
                this.membersBeingAdded.set(i + 1);
            }
            this.isLoading.set(false);
            this.membersAdded.emit();
            this.onClose();
        } catch (error) {
            this.isLoading.set(false);
            this.errorMessage.set('Failed to add some members. Please try again.');
            console.error('Error adding members:', error);
        }
    }

    onClose(): void {
        this.members.set([]);
        this.memberForm.reset({ memberRole: 'PROJECT_HANDLER' });
        this.errorMessage.set(null);
        this.userSuggestions.set([]);
        this.showDropdown.set(false);
        this.close.emit();
    }

    private getAvatarGradient(index: number): string {
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
}
