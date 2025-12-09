import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { LucideAngularModule, Eye, EyeOff, Mail, Lock, User, ArrowRight, LogIn } from 'lucide-angular';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './auth.html',
  styleUrl: './auth.scss'
})
export class AuthComponent {
  isLogin = true;
  showPassword = false;

  formData = {
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  };

  Eye = Eye; EyeOff = EyeOff; Mail = Mail; Lock = Lock; User = User; ArrowRight = ArrowRight; LogIn = LogIn;

  constructor(private auth: AuthService, private router: Router) {}

  toggleMode() {
    this.isLogin = !this.isLogin;
    this.formData = { name: '', email: '', password: '', confirmPassword: '' };
  }

  submit(form: NgForm) {
    if (!form.valid) {
      return;
    }
    if (!this.isLogin && this.formData.password !== this.formData.confirmPassword) {
      return;
    }
    if (this.isLogin) {
      this.auth.login(this.formData.email, this.formData.password).subscribe(() => {
        this.router.navigate(['/home']);
      });
    } else {
      this.auth.signup(this.formData.name, this.formData.email, this.formData.password).subscribe(() => {
        this.router.navigate(['/home']);
      });
    }
  }
}

