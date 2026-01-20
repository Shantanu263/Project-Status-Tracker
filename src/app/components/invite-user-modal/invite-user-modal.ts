import { Component, input, output, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

interface UserToInvite {
    email: string;
    roleName: string;
    initials: string;
    color: string;
}

@Component({
    selector: 'app-invite-user-modal',
    imports: [CommonModule, ReactiveFormsModule, MatSnackBarModule],
    templateUrl: './invite-user-modal.html',
    styleUrl: './invite-user-modal.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class InviteUserModalComponent {
    private fb = inject(FormBuilder);
    private http = inject(HttpClient);
    private snackBar = inject(MatSnackBar);

    // Input/Output
    isOpen = input.required<boolean>();
    close = output<void>();
    usersInvited = output<void>();

    // State
    users = signal<UserToInvite[]>([]);
    isLoading = signal(false);
    usersBeingInvited = signal(0);
    errorMessage = signal<string | null>(null);

    // Form
    userForm: FormGroup;

    constructor() {
        this.userForm = this.fb.group({
            userEmail: ['', [Validators.required, Validators.email]],
            userRole: ['MEMBER', Validators.required]
        });
    }

    addUser(): void {
        if (this.userForm.invalid) return;

        const email = this.userForm.get('userEmail')?.value;
        const roleName = this.userForm.get('userRole')?.value;

        // Check if user already exists
        if (this.users().some(u => u.email === email)) {
            this.errorMessage.set('This user has already been added');
            return;
        }

        const initials = this.getInitials(email);
        const color = this.getAvatarGradient(this.users().length);

        this.users.update(users => [...users, { email, roleName, initials, color }]);
        this.userForm.patchValue({ userEmail: '' });
        this.errorMessage.set(null);
    }

    removeUser(index: number): void {
        this.users.update(users => users.filter((_, i) => i !== index));
    }

    async finishAndInviteUsers(): Promise<void> {
        const usersToInvite = this.users();

        if (usersToInvite.length === 0) {
            this.onClose();
            return;
        }

        this.isLoading.set(true);
        this.errorMessage.set(null);
        this.usersBeingInvited.set(0);

        try {
            for (let i = 0; i < usersToInvite.length; i++) {
                const user = usersToInvite[i];
                await this.http.post(`${environment.apiUrl}/admin/invite-user`, {
                    email: user.email,
                    roleName: user.roleName
                }).toPromise();
                this.usersBeingInvited.set(i + 1);
            }

            this.isLoading.set(false);

            // Show success snackbar
            this.snackBar.open(
                `Successfully invited ${usersToInvite.length} user(s)!`,
                'Close',
                {
                    duration: 5000,
                    horizontalPosition: 'center',
                    verticalPosition: 'bottom',
                    panelClass: ['snackbar-success']
                }
            );

            this.usersInvited.emit();
            this.onClose();
        } catch (error: any) {
            this.isLoading.set(false);
            const errorMsg = error?.error?.message || 'Failed to invite some users. Please try again.';
            this.errorMessage.set(errorMsg);
            console.error('Error inviting users:', error);
        }
    }

    onClose(): void {
        this.users.set([]);
        this.userForm.reset({ userRole: 'MEMBER' });
        this.errorMessage.set(null);
        this.close.emit();
    }

    private getInitials(email: string): string {
        const name = email.split('@')[0];
        return name.substring(0, 2).toUpperCase();
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

    getRoleDisplayName(roleName: string): string {
        const roleMap: Record<string, string> = {
            'SUPER_ADMIN': 'Super Admin',
            'ADMIN': 'Admin',
            'MEMBER': 'Member'
        };
        return roleMap[roleName] || roleName;
    }
}
