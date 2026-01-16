import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import { Project, ProjectMember } from '../models/project.model';
import { DashboardData, ProjectsDashboardData } from '../models/dashboard.model';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Phase, Task, Comment } from '../models/phase.model';

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
    //projectHeadId: string | number;
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
    return this.http.delete<void>(`${this.api}/${projectId}/phases/${phaseId}/tasks/${taskId}`);
  }

  updatePhase(projectId: number, phaseId: number, updates: Partial<Phase>): Observable<Phase> {
    return this.http.put<Phase>(`${this.api}/${projectId}/phase/${phaseId}`, updates);
  }

  updateTask(projectId: number, phaseId: number, taskId: number, updates: Partial<Task>): Observable<Task> {
    return this.http.put<Task>(`${this.api}/${projectId}/phases/${phaseId}/tasks/${taskId}`, updates);
  }

  getTaskDetails(projectId: number, phaseId: number, taskId: number): Observable<Task> {
    return this.http.get<Task>(`${this.api}/${projectId}/phases/${phaseId}/tasks/${taskId}`);
  }

  // Comment operations
  addComment(taskId: number, content: string): Observable<Comment> {
    return this.http.post<Comment>(`${this.api}/tasks/${taskId}/comments`, { content });
  }

  updateComment(commentId: number, content: string): Observable<Comment> {
    return this.http.patch<Comment>(`${this.api}/comments/${commentId}`, { content });
  }

  deleteComment(commentId: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/comments/${commentId}`);
  }

  getProjectMembers(projectId: number): Observable<ProjectMember[]> {
    return this.http.get<ProjectMember[]>(`${this.api}/${projectId}/project-members`);
  }

  getProjectMember(memberId: number): Observable<ProjectMember> {
    return this.http.get<ProjectMember>(`${this.api}/project-member/${memberId}`);
  }

  applyTemplateToProject(projectId: number, templateId: number): Observable<any> {
    return this.http.post<any>(`${this.api}/${projectId}/phases/template/${templateId}`, {});
  }

  getProjectsDashboard(): Observable<ProjectsDashboardData> {
    return this.http.get<ProjectsDashboardData>(`${this.api}/projects-dashboard`);
  }

  // Subtask operations
  getSubtaskDetails(projectId: number, phaseId: number, taskId: number, subTaskId: number): Observable<any> {
    return this.http.get<any>(`${this.api}/${projectId}/phases/${phaseId}/tasks/${taskId}/subtasks/${subTaskId}`);
  }

  updateSubtask(projectId: number, phaseId: number, taskId: number, subTaskId: number, updates: any): Observable<any> {
    return this.http.put<any>(`${this.api}/${projectId}/phases/${phaseId}/tasks/${taskId}/subtasks/${subTaskId}`, updates);
  }

  createSubtask(projectId: number, phaseId: number, taskId: number, subtask: any): Observable<any> {
    return this.http.post<any>(`${this.api}/${projectId}/phases/${phaseId}/tasks/${taskId}/subtasks`, subtask);
  }

  deleteSubtask(projectId: number, phaseId: number, taskId: number, subTaskId: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${projectId}/phases/${phaseId}/tasks/${taskId}/subtasks/${subTaskId}`);
  }

  // Project operations
  updateProject(projectId: number, updates: Partial<{
    projectName: string;
    description: string;
    startDate: string;
    endDate: string;
    priority: string;
    status: string;
  }>): Observable<Project> {
    return this.http.put<Project>(`${this.api}/${projectId}`, updates);
  }

  deleteProject(projectId: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${projectId}`);
  }
}
