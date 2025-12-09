import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import { Project, ProjectMember } from '../models/project.model';
import { DashboardData } from '../models/dashboard.model';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Phase, Task } from '../models/phase.model';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  constructor(private http: HttpClient) { }
  private api = environment.apiUrl + '/project';

  getProjectById(id: number): Observable<Project> {
    return this.http.get<Project>(`${this.api}/${id}`);
  }

  createProject(payload: {
    projectName: string;
    description: string;
    startDate: string;
    endDate: string;
    projectHeadId: string | number;
    templateId: number;
  }): Observable<Project> {
    return this.http.post<Project>(`${this.api}`, payload);
  }

  addMemberToProject(projectId: number, memberEmail: string, roleInProject: string): Observable<any> {
    return this.http.post<any>(
      `${this.api}/${projectId}/project-members/add-user`,
      { email: memberEmail, roleInProject }
    );
  }

  getProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(`${this.api}`);
  }

  getDashboardData(projectId: number): Observable<DashboardData> {
    return this.http.get<DashboardData>(`${this.api}/${projectId}/dashboard`);
  }

  getPhases(projectId: number): Observable<Phase[]> {
    return this.http.get<Phase[]>(`${this.api}/${projectId}/phases`);
  }

  getTasks(projectId: number, phaseId: number): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.api}/${projectId}/phases/${phaseId}/tasks`);
  }

  createPhase(projectId: number, phase: Phase): Observable<Phase> {
    return this.http.post<Phase>(`${this.api}/${projectId}/phases`, phase);
  }

  deletePhase(projectId: number, phaseId: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${projectId}/phase/${phaseId}`);
  }

  createTask(projectId: number, phaseId: number, task: Task): Observable<Task> {
    return this.http.post<Task>(`${this.api}/${projectId}/phases/${phaseId}/tasks`, task);
  }

  deleteTask(projectId: number, phaseId: number, taskId: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${projectId}/phase/${phaseId}/tasks/${taskId}`);
  }

  updatePhase(projectId: number, phaseId: number, updates: Partial<Phase>): Observable<Phase> {
    return this.http.put<Phase>(`${this.api}/${projectId}/phase/${phaseId}`, updates);
  }

  updateTask(projectId: number, phaseId: number, taskId: number, updates: Partial<Task>): Observable<Task> {
    return this.http.put<Task>(`${this.api}/${projectId}/phases/${phaseId}/tasks/${taskId}`, updates);
  }

  getProjectMembers(projectId: number): Observable<ProjectMember[]> {
    return this.http.get<ProjectMember[]>(`${this.api}/${projectId}/project-members`);
  }

  applyTemplateToProject(projectId: number, templateId: number): Observable<any> {
    return this.http.post<any>(`${this.api}/${projectId}/phases/template/${templateId}`, {});
  }
}
