import { Component, ChangeDetectionStrategy, input, output, signal, inject, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule, X, Edit2, Check, XIcon } from 'lucide-angular';
import { UserAccountService, UserDetailsResponse } from '../../../services/user-account.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ResetPasswordModalComponent } from '../reset-password-modal/reset-password-modal.component';

@Component({
    selector: 'app-account-panel',
    imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, MatSnackBarModule, ResetPasswordModalComponent],
    templateUrl: './account-panel.component.html',
    styleUrl: './account-panel.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '(document:keydown.escape)': 'onEscapeKey()'
    }
})
export class AccountPanelComponent {
    // Icons
    X = X;
    Edit2 = Edit2;
    Check = Check;
    XIcon = XIcon;

    // Inputs/Outputs
    isOpen = input.required<boolean>();
    userId = input.required<number>();
    close = output<void>();
    usernameUpdated = output<string>();

    // Services
    private userAccountService = inject(UserAccountService);
    private snackBar = inject(MatSnackBar);

    // State
    editingUsername = signal(false);
    isLoading = signal(false);
    errorMessage = signal<string | null>(null);
    showResetPasswordModal = signal(false);
    userDetails = signal<UserDetailsResponse | null>(null);
    isLoadingUserDetails = signal(false);

    // Form controls
    usernameControl = new FormControl('', [Validators.required, Validators.minLength(2)]);
    usernameValue = signal('');

    // Computed
    userInitials = computed(() => {
        const details = this.userDetails();
        if (!details?.name) return 'U';
        const parts = details.name.split(' ');
        if (parts.length >= 2) {
            return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
        }
        return details.name.substring(0, 2).toUpperCase();
    });

    hasUsernameChanged = computed(() => {
        const currentValue = this.usernameValue().trim();
        const originalValue = this.userDetails()?.name?.trim() || '';
        const isValid = this.usernameControl.valid;
        return currentValue !== originalValue && isValid && currentValue.length > 0;
    });

    constructor() {
        // Fetch user details when panel opens
        effect(() => {
            if (this.isOpen() && this.userId()) {
                this.fetchUserDetails();
            }
        }, { allowSignalWrites: true });
    }

    fetchUserDetails() {
        this.isLoadingUserDetails.set(true);
        this.userAccountService.getUserDetails(this.userId()).subscribe({
            next: (details) => {
                this.userDetails.set(details);
                this.isLoadingUserDetails.set(false);
            },
            error: (error) => {
                console.error('Failed to fetch user details:', error);
                this.isLoadingUserDetails.set(false);
            }
        });
    }

    onEscapeKey(): void {
        if (this.isOpen() && !this.showResetPasswordModal()) {
            this.closePanel();
        }
    }

    startEditingUsername() {
        this.editingUsername.set(true);
        const currentName = this.userDetails()?.name || '';
        this.usernameControl.setValue(currentName);
        this.usernameValue.set(currentName);
        this.errorMessage.set(null);

        // Subscribe to value changes to update signal
        this.usernameControl.valueChanges.subscribe(value => {
            this.usernameValue.set(value || '');
        });
    }

    cancelEditingUsername() {
        this.editingUsername.set(false);
        const originalName = this.userDetails()?.name || '';
        this.usernameControl.setValue(originalName);
        this.usernameValue.set(originalName);
        this.errorMessage.set(null);
    }

    saveUsername() {
        if (!this.hasUsernameChanged() || this.usernameControl.invalid) return;

        const newUsername = this.usernameControl.value!.trim();
        this.isLoading.set(true);
        this.errorMessage.set(null);

        this.userAccountService.updateUsername(this.userId(), newUsername).subscribe({
            next: (response) => {
                this.isLoading.set(false);
                this.editingUsername.set(false);
                this.snackBar.open('Username updated successfully!', 'Close', {
                    duration: 3000,
                    panelClass: ['success-snackbar']
                });
                // Refetch user details to update the account panel
                this.fetchUserDetails();
                // Emit the updated username to update navbar
                this.usernameUpdated.emit(newUsername);
            },
            error: (error) => {
                this.isLoading.set(false);
                this.errorMessage.set(error.error?.message || 'Failed to update username. Please try again.');
            }
        });
    }

    openResetPasswordModal() {
        this.showResetPasswordModal.set(true);
    }

    closeResetPasswordModal() {
        this.showResetPasswordModal.set(false);
    }

    closePanel() {
        this.editingUsername.set(false);
        this.errorMessage.set(null);
        const originalName = this.userDetails()?.name || '';
        this.usernameControl.setValue(originalName);
        this.usernameValue.set(originalName);
        this.close.emit();
    }

    onBackdropClick(event: MouseEvent) {
        if (event.target === event.currentTarget && !this.showResetPasswordModal()) {
            this.closePanel();
        }
    }
}
