import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { LucideAngularModule, Eye, EyeOff, Mail, Lock, User, ArrowRight, LogIn } from 'lucide-angular';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, MatSnackBarModule, ForgotPasswordComponent],
  templateUrl: './auth.html',
  styleUrl: './auth.scss'
})
export class AuthComponent {
  isLogin = true;
  showPassword = false;
  isForgotPasswordOpen = signal(false);

  formData = {
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  };

  Eye = Eye; EyeOff = EyeOff; Mail = Mail; Lock = Lock; User = User; ArrowRight = ArrowRight; LogIn = LogIn;

  private auth = inject(AuthService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  toggleMode() {
    this.isLogin = !this.isLogin;
    this.formData = { name: '', email: '', password: '', confirmPassword: '' };
  }

  openForgotPassword() {
    this.isForgotPasswordOpen.set(true);
  }

  closeForgotPassword() {
    this.isForgotPasswordOpen.set(false);
  }

  submit(form: NgForm) {
    if (!form.valid) {
      return;
    }
    if (!this.isLogin && this.formData.password !== this.formData.confirmPassword) {
      return;
    }
    if (this.isLogin) {
      this.auth.login(this.formData.email, this.formData.password).subscribe({
        next: () => {
          // Show success notification
          this.snackBar.open('Login successful! Welcome back.', 'Close', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });
          // Redirect to projects dashboard
          this.router.navigate(['/home/projects-dashboard']);
        }
      });
    } else {
      this.auth.signup(this.formData.name, this.formData.email, this.formData.password).subscribe({
        next: () => {
          // Show success message
          this.snackBar.open('Account created successfully! Please login.', 'Close', {
            duration: 4000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: ['success-snackbar']
          });
          // Switch to login mode
          this.isLogin = true;
          // Clear form but keep email for convenience
          const email = this.formData.email;
          this.formData = { name: '', email: email, password: '', confirmPassword: '' };
        }
      });
    }
  }
}

