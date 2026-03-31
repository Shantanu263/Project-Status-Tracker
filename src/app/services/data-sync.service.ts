import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class DataSyncService {
    // Phase updates
    private phasesUpdated = new Subject<number>();
    phasesUpdated$ = this.phasesUpdated.asObservable();

    // Task updates
    private tasksUpdated = new Subject<{ projectId: number; phaseId: number }>();
    tasksUpdated$ = this.tasksUpdated.asObservable();

    // Subtask updates
    private subtasksUpdated = new Subject<{ projectId: number; phaseId: number; taskId: number }>();
    subtasksUpdated$ = this.subtasksUpdated.asObservable();

    // Project members updates
    private projectMembersUpdated = new Subject<number>();
    projectMembersUpdated$ = this.projectMembersUpdated.asObservable();

    // Delay tracker updates
    private delayTrackerUpdated = new Subject<number>();
    delayTrackerUpdated$ = this.delayTrackerUpdated.asObservable();

    // Call this when phases are created, updated, or deleted
    notifyPhasesUpdated(projectId: number): void {
        this.phasesUpdated.next(projectId);
    }

    // Call this when tasks are created, updated, or deleted
    notifyTasksUpdated(projectId: number, phaseId: number): void {
        this.tasksUpdated.next({ projectId, phaseId });
    }

    // Call this when subtasks are created, updated, or deleted
    notifySubtasksUpdated(projectId: number, phaseId: number, taskId: number): void {
        this.subtasksUpdated.next({ projectId, phaseId, taskId });
    }

    // Call this when project members are added, updated, or removed
    notifyProjectMembersUpdated(projectId: number): void {
        this.projectMembersUpdated.next(projectId);
    }

    // Call this when delay logs are created, updated, or deleted
    notifyDelayTrackerUpdated(projectId: number): void {
        this.delayTrackerUpdated.next(projectId);
    }
}
