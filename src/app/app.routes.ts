import { Routes } from '@angular/router';
import { AuthComponent } from './components/auth/auth';
import { AuthGuard } from './guards/auth.guard';
import { HomeLayoutComponent } from './layouts/home-layout/home-layout';
import { ProjectContentComponent } from './components/project-content/project-content';
import { ProjectsDashboard } from './components/projects-dashboard/projects-dashboard';

export const routes: Routes = [
  { path: '', component: AuthComponent, pathMatch: 'full' },
  { path: 'auth', component: AuthComponent },
  {
    path: 'home',
    component: HomeLayoutComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '', component: ProjectContentComponent },
      { path: 'projects-dashboard', component: ProjectsDashboard },
      { path: 'user-management', component: ProjectContentComponent },
      { path: 'projects/:projectId', component: ProjectContentComponent },
      { path: 'projects/:projectId/:tab', component: ProjectContentComponent }
    ]
  },
  { path: '**', redirectTo: 'home' }
];