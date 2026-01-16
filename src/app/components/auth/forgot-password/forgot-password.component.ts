import { Component, ChangeDetectionStrategy, input, output, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '../../shared/modal/modal';
import { LucideAngularModule, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-angular';
import { ForgotPasswordService } from '../../../services/forgot-password.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

type ForgotStep = 'EMAIL' | 'OTP' | 'RESET';

@Component({
    selector: 'app-forgot-password',
    imports: [CommonModule, ReactiveFormsModule, ModalComponent, LucideAngularModule, MatSnackBarModule],
    templateUrl: './forgot-password.component.html',
    styleUrl: './forgot-password.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ForgotPasswordComponent {
    // Icons
    Mail = Mail;
    Lock = Lock;
    Eye = Eye;
    EyeOff = EyeOff;
    ArrowRight = ArrowRight;

    // Inputs/Outputs
    isOpen = input.required<boolean>();
    close = output<void>();

    // Services
    private fb = inject(FormBuilder);
    private forgotPasswordService = inject(ForgotPasswordService);
    private snackBar = inject(MatSnackBar);

    // State
    currentStep = signal<ForgotStep>('EMAIL');
    isLoading = signal(false);
    errorMessage = signal<string | null>(null);
    resetToken = signal<string | null>(null);
    userEmail = signal<string>('');
    showNewPassword = signal(false);
    showConfirmPassword = signal(false);
    showOtp = signal(false);
    resendCooldown = signal(0);
    passwordResetSuccess = signal(false);

    // Forms
    emailForm: FormGroup;
    otpForm: FormGroup;
    resetPasswordForm: FormGroup;

    // Computed
    maskedEmail = computed(() => {
        const email = this.userEmail();
        if (!email) return '';
        const [localPart, domain] = email.split('@');
        if (!localPart || !domain) return email;
        const visibleChars = Math.min(2, localPart.length);
        const masked = localPart.substring(0, visibleChars) + '*****';
        return `${masked}@${domain}`;
    });

    canResendOtp = computed(() => this.resendCooldown() === 0);

    constructor() {
        // Initialize forms
        this.emailForm = this.fb.group({
            email: ['', [Validators.required, Validators.email]]
        });

        this.otpForm = this.fb.group({
            otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
        });

        this.resetPasswordForm = this.fb.group({
            newPassword: ['', [Validators.required, Validators.minLength(8)]],
            confirmPassword: ['', [Validators.required]]
        }, { validators: this.passwordMatchValidator });
    }

    // Custom validator for password match
    private passwordMatchValidator(form: FormGroup) {
        const newPassword = form.get('newPassword')?.value;
        const confirmPassword = form.get('confirmPassword')?.value;
        return newPassword === confirmPassword ? null : { passwordMismatch: true };
    }

    // Step 1: Send OTP
    sendOtp() {
        if (this.emailForm.invalid) return;

        this.isLoading.set(true);
        this.errorMessage.set(null);
        const email = this.emailForm.value.email;

        this.forgotPasswordService.verifyEmail(email).subscribe({
            next: () => {
                this.userEmail.set(email);
                this.currentStep.set('OTP');
                this.isLoading.set(false);
                this.startResendCooldown();
                this.snackBar.open('OTP sent successfully to your email!', 'Close', {
                    duration: 4000,
                    panelClass: ['success-snackbar']
                });
            },
            error: (error) => {
                this.isLoading.set(false);
                this.errorMessage.set(error.error?.message || 'Email not registered. Please try again.');
            }
        });
    }

    // Step 2: Verify OTP
    verifyOtp() {
        if (this.otpForm.invalid) return;

        this.isLoading.set(true);
        this.errorMessage.set(null);
        const otp = parseInt(this.otpForm.value.otp, 10);

        this.forgotPasswordService.verifyOtp(this.userEmail(), otp).subscribe({
            next: (response) => {
                this.resetToken.set(response.resetToken);
                this.currentStep.set('RESET');
                this.isLoading.set(false);
                this.snackBar.open('OTP verified successfully!', 'Close', {
                    duration: 3000,
                    panelClass: ['success-snackbar']
                });
            },
            error: (error) => {
                this.isLoading.set(false);
                this.errorMessage.set(error.error?.message || 'Invalid or expired OTP. Please try again.');
            }
        });
    }

    // Resend OTP
    resendOtp() {
        if (!this.canResendOtp()) return;

        this.isLoading.set(true);
        this.errorMessage.set(null);

        this.forgotPasswordService.verifyEmail(this.userEmail()).subscribe({
            next: () => {
                this.isLoading.set(false);
                this.otpForm.reset();
                this.startResendCooldown();
            },
            error: (error) => {
                this.isLoading.set(false);
                this.errorMessage.set(error.error?.message || 'Failed to resend OTP. Please try again.');
            }
        });
    }

    // Start resend cooldown (60 seconds)
    private startResendCooldown() {
        this.resendCooldown.set(60);
        const interval = setInterval(() => {
            const current = this.resendCooldown();
            if (current <= 1) {
                clearInterval(interval);
                this.resendCooldown.set(0);
            } else {
                this.resendCooldown.set(current - 1);
            }
        }, 1000);
    }

    // Step 3: Reset Password
    resetPassword() {
        if (this.resetPasswordForm.invalid) return;

        const token = this.resetToken();
        if (!token) {
            this.errorMessage.set('Reset token is missing. Please restart the process.');
            return;
        }

        this.isLoading.set(true);
        this.errorMessage.set(null);
        const newPassword = this.resetPasswordForm.value.newPassword;

        this.forgotPasswordService.resetPassword(newPassword, token).subscribe({
            next: () => {
                this.isLoading.set(false);
                this.passwordResetSuccess.set(true);
                // Show success and close modal
                this.handleSuccess();
            },
            error: (error) => {
                this.isLoading.set(false);
                this.errorMessage.set(error.error?.message || 'Failed to reset password. Please try again.');
            }
        });
    }

    // Handle successful password reset
    private handleSuccess() {
        // Close modal and reset state
        setTimeout(() => {
            this.closeModal();
            this.resetState();
        }, 2000);
    }

    // Close modal
    closeModal() {
        this.resetState();
        this.close.emit();
    }

    // Reset component state
    private resetState() {
        this.currentStep.set('EMAIL');
        this.isLoading.set(false);
        this.errorMessage.set(null);
        this.resetToken.set(null);
        this.userEmail.set('');
        this.showNewPassword.set(false);
        this.showConfirmPassword.set(false);
        this.showOtp.set(false);
        this.resendCooldown.set(0);
        this.passwordResetSuccess.set(false);
        this.emailForm.reset();
        this.otpForm.reset();
        this.resetPasswordForm.reset();
    }

    // Toggle password visibility
    toggleNewPasswordVisibility() {
        this.showNewPassword.set(!this.showNewPassword());
    }

    toggleConfirmPasswordVisibility() {
        this.showConfirmPassword.set(!this.showConfirmPassword());
    }

    toggleOtpVisibility() {
        this.showOtp.set(!this.showOtp());
    }

    // Get form field
    getFormControl(form: FormGroup, fieldName: string) {
        return form.get(fieldName);
    }
}
