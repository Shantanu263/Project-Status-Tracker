import { Component, ChangeDetectionStrategy, input, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '../../shared/modal/modal';
import { LucideAngularModule, Lock, Eye, EyeOff, ArrowRight } from 'lucide-angular';
import { UserAccountService } from '../../../services/user-account.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
    selector: 'app-reset-password-modal',
    imports: [CommonModule, ReactiveFormsModule, ModalComponent, LucideAngularModule, MatSnackBarModule],
    templateUrl: './reset-password-modal.component.html',
    styleUrl: './reset-password-modal.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResetPasswordModalComponent {
    // Icons
    Lock = Lock;
    Eye = Eye;
    EyeOff = EyeOff;
    ArrowRight = ArrowRight;

    // Inputs/Outputs
    isOpen = input.required<boolean>();
    userId = input.required<number>();
    close = output<void>();

    // Services
    private fb = inject(FormBuilder);
    private userAccountService = inject(UserAccountService);
    private snackBar = inject(MatSnackBar);

    // State
    isLoading = signal(false);
    errorMessage = signal<string | null>(null);
    showCurrentPassword = signal(false);
    showNewPassword = signal(false);
    showConfirmPassword = signal(false);

    // Form
    resetPasswordForm: FormGroup;

    constructor() {
        this.resetPasswordForm = this.fb.group({
            currentPassword: ['', [Validators.required]],
            newPassword: ['', [Validators.required, Validators.minLength(8)]],
            confirmPassword: ['', [Validators.required]]
        }, { validators: this.passwordMatchValidator });
    }

    // Custom validator for password match
    private passwordMatchValidator(form: FormGroup) {
        const newPassword = form.get('newPassword')?.value;
        const confirmPassword = form.get('confirmPassword')?.value;

        // Check if new password is same as current password
        const currentPassword = form.get('currentPassword')?.value;
        if (newPassword && currentPassword && newPassword === currentPassword) {
            return { sameAsOld: true };
        }

        // Check if new password matches confirm password
        if (newPassword && confirmPassword && newPassword !== confirmPassword) {
            return { passwordMismatch: true };
        }

        return null;
    }

    resetPassword() {
        if (this.resetPasswordForm.invalid) return;

        this.isLoading.set(true);
        this.errorMessage.set(null);

        const { currentPassword, newPassword } = this.resetPasswordForm.value;

        this.userAccountService.updatePassword(this.userId(), currentPassword, newPassword).subscribe({
            next: () => {
                this.isLoading.set(false);
                this.snackBar.open('Password updated successfully! Logging out...', 'Close', {
                    duration: 2000,
                    panelClass: ['success-snackbar']
                });

                // Logout and redirect to login after short delay
                setTimeout(() => {
                    this.closeModal();
                    // Logout user
                    localStorage.removeItem('token');
                    sessionStorage.removeItem('token');
                    // Redirect to login
                    window.location.href = '/auth/login';
                }, 2000);
            },
            error: (error) => {
                this.isLoading.set(false);
                this.errorMessage.set(error.error?.message || 'Failed to update password. Please try again.');
            }
        });
    }

    closeModal() {
        this.resetState();
        this.close.emit();
    }

    private resetState() {
        this.isLoading.set(false);
        this.errorMessage.set(null);
        this.showCurrentPassword.set(false);
        this.showNewPassword.set(false);
        this.showConfirmPassword.set(false);
        this.resetPasswordForm.reset();
    }

    toggleCurrentPasswordVisibility() {
        this.showCurrentPassword.set(!this.showCurrentPassword());
    }

    toggleNewPasswordVisibility() {
        this.showNewPassword.set(!this.showNewPassword());
    }

    toggleConfirmPasswordVisibility() {
        this.showConfirmPassword.set(!this.showConfirmPassword());
    }
}
