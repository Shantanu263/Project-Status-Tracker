import { Routes } from '@angular/router';
import { AuthComponent } from './components/auth/auth';
import { AuthGuard } from './guards/auth.guard';
import { HomeLayoutComponent } from './layouts/home-layout/home-layout';

export const routes: Routes = [
  { path: '', component: AuthComponent, pathMatch: 'full' },
  { path: 'auth', component: AuthComponent },
  { path: 'home', component: HomeLayoutComponent, canActivate: [AuthGuard] },
  { path: '', redirectTo: 'home', pathMatch: 'full'}
];