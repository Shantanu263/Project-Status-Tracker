import { ChangeDetectionStrategy, Component, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { SelectedProjectService } from '../../services/selected-project.service';
import { ProjectService } from '../../services/project.service';
import { MatIconModule } from '@angular/material/icon';
import { TaskFormComponent } from '../phases/task-form/task-form';
import { TaskDetailsModalComponent } from '../phases/task-details-modal/task-details-modal';
import { Task } from '../../models/phase.model';
import { ProjectMember } from '../../models/project.model';

type TaskStatus = 'TO_DO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';

interface TaskResponse {
  taskId: number;
  taskName: string;
  description: string;
  startDate: string;
  endDate: string;
  status: TaskStatus;
  priority: string;
  assignedTo: {
    userId: number;
    name: string;
    email: string;
  };
  //assignedTo: number;
}

interface PhaseResponse {
  phaseId: number;
  phaseName: string;
}

interface TaskCard {
  id: string | number;
  title: string;
  description: string;
  category: string;
  priority: 'Low' | 'Medium' | 'High';
  dueDate: string;
  assignees: { initials: string; name: string }[];
  status: TaskStatus;
}

interface Column {
  id: string;
  title: string;
  statusValue: TaskStatus;
  colorDot: 'gray' | 'blue' | 'yellow' | 'green';
  tasks: TaskCard[];
}

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [CommonModule, MatIconModule, TaskFormComponent, TaskDetailsModalComponent],
  templateUrl: './board.html',
  styleUrl: './board.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BoardComponent {
  private readonly http = inject(HttpClient);
  private readonly selectedProjectService = inject(SelectedProjectService);
  private readonly projectService = inject(ProjectService);

  phases = signal<PhaseResponse[]>([]);
  selectedPhase = signal<PhaseResponse | null>(null);
  columns = signal<Column[]>([
    {
      id: 'todo',
      title: 'To Do',
      statusValue: 'TO_DO',
      colorDot: 'gray',
      tasks: []
    },
    {
      id: 'ongoing',
      title: 'In Progress',
      statusValue: 'IN_PROGRESS',
      colorDot: 'blue',
      tasks: []
    },
    {
      id: 'review',
      title: 'Review',
      statusValue: 'REVIEW',
      colorDot: 'yellow',
      tasks: []
    },
    {
      id: 'completed',
      title: 'Done',
      statusValue: 'DONE',
      colorDot: 'green',
      tasks: []
    }
  ]);

  loading = signal(false);
  error = signal<string | null>(null);
  draggingTask = signal<{ task: TaskCard; fromColumnId: string } | null>(null);
  hoveredColumnId = signal<string | null>(null);
  showTaskModal = signal(false);
  selectedColumnForTask = signal<Column | null>(null);
  showTaskDetailsModal = signal(false);
  selectedTaskForDetails = signal<{ taskId: number; phaseId: number } | null>(null);
  projectMembers = signal<ProjectMember[]>([]);

  selectedProject = computed(() => this.selectedProjectService.getSelectedProject()());

  // Calculate the maximum task count across all columns for consistent height
  maxTaskCount = computed(() => {
    const columns = this.columns();
    const MIN_CARDS = 3; // Minimum for visual consistency
    return Math.max(...columns.map(col => col.tasks.length), MIN_CARDS);
  });

  constructor() {
    effect(() => {
      const project = this.selectedProject();
      this.resetBoardState();
      if (project) {
        this.loadPhases();
        this.loadProjectMembers();
      }
    }, { allowSignalWrites: true });
  }

  loadProjectMembers(): void {
    const project = this.selectedProject();
    if (!project) return;

    this.projectService.getProjectMembers(project.projectId).subscribe({
      next: (members) => {
        this.projectMembers.set(members);
      },
      error: (err) => {
        console.error('Error loading project members:', err);
      }
    });
  }

  colorDotMap = {
    gray: 'bg-gray-400',
    blue: 'bg-blue-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500'
  };

  priorityColorMap: Record<string, string> = {
    'High': 'bg-red-100 text-red-700',
    'Medium': 'bg-yellow-100 text-yellow-700',
    'Low': 'bg-gray-100 text-gray-700'
  };

  loadPhases(): void {
    const project = this.selectedProject();
    if (!project) return;

    this.http.get<PhaseResponse[]>(`${environment.apiUrl}/project/${project.projectId}/phases`).subscribe({
      next: (phases) => {
        // Sort phases by phaseId in ascending order
        const sortedPhases = phases.sort((a, b) => a.phaseId - b.phaseId);
        this.phases.set(sortedPhases);
        if (sortedPhases.length > 0) {
          this.selectedPhase.set(sortedPhases[0]);
          this.loadTasksForPhase(sortedPhases[0]);
        }
      },
      error: (err) => {
        this.error.set('Failed to load phases');
        console.error('Error loading phases:', err);
      }
    });
  }

  onPhaseChange(phaseId: number): void {
    const phase = this.phases().find(p => p.phaseId === phaseId);
    if (!phase) {
      console.error(`Phase with ID ${phaseId} not found`);
      return;
    }

    this.selectedPhase.set(phase);
    this.loadTasksForPhase(phase);
  }

  loadTasksForPhase(phase: PhaseResponse): void {
    const project = this.selectedProject();
    if (!project) return;

    this.loading.set(true);
    this.error.set(null);

    const url = `${environment.apiUrl}/project/${project.projectId}/phases/${phase.phaseId}/tasks`;

    this.http.get<TaskResponse[]>(url).subscribe({
      next: (tasks) => {
        this.organizeTasks(tasks);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load tasks');
        this.loading.set(false);
        console.error('Error loading tasks:', err);
      }
    });
  }

  organizeTasks(tasks: TaskResponse[]): void {
    const columns = this.columns();

    // Reset all tasks
    columns.forEach(col => col.tasks = []);

    // Organize tasks by status
    tasks.forEach(task => {
      const taskStatus = task.status;

      const taskCard: TaskCard = {
        id: task.taskId,
        title: task.taskName,
        description: task.description,
        category: task.priority,
        priority: (task.priority as 'Low' | 'Medium' | 'High'),
        dueDate: task.endDate,
        status: taskStatus,
        assignees: task.assignedTo ? [{ initials: this.getInitials(task.assignedTo.name), name: task.assignedTo.name }] : []
        //assignees: [{ initials: "task.assignedTo.name", name: "task.assignedTo.name" }]
      };

      const column = columns.find(col => col.statusValue === taskStatus);
      if (column) {
        column.tasks.push(taskCard);
      }
    });

    this.columns.set([...columns]);
  }

  private resetBoardState(): void {
    this.phases.set([]);
    this.selectedPhase.set(null);
    this.columns.update(cols => cols.map(col => ({ ...col, tasks: [] })));
    this.loading.set(false);
    this.error.set(null);
  }

  getTaskCountBadgeColor(columnId: string): string {
    const colorMap: Record<string, string> = {
      todo: 'bg-gray-100 text-gray-600',
      ongoing: 'bg-blue-100 text-blue-600',
      review: 'bg-yellow-100 text-yellow-600',
      completed: 'bg-green-100 text-green-600'
    };
    return colorMap[columnId];
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  // Drag and Drop handlers
  onDragStart(task: TaskCard, columnId: string): void {
    this.draggingTask.set({ task, fromColumnId: columnId });
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
  }

  onDrop(toColumnId: string, event: DragEvent): void {
    event.preventDefault();
    const dragging = this.draggingTask();
    if (!dragging) return;

    const { task, fromColumnId } = dragging;

    if (fromColumnId === toColumnId) {
      this.draggingTask.set(null);
      return;
    }

    // Find the new status value
    const toColumn = this.columns().find(col => col.id === toColumnId);
    if (!toColumn) return;

    // Update status on backend
    this.updateTaskStatus(task, toColumn.statusValue);
  }

  updateTaskStatus(task: TaskCard, newStatus: TaskStatus): void {
    const project = this.selectedProject();
    const phase = this.selectedPhase();
    if (!project || !phase) return;

    const url = `${environment.apiUrl}/project/${project.projectId}/phases/${phase.phaseId}/tasks/${task.id}/status`;
    const params = { status: newStatus };

    this.http.patch<any>(url, {}, { params }).subscribe({
      next: () => {
        // Move task in UI
        const columns = this.columns();
        const fromColumn = columns.find(col => col.tasks.some(t => t.id === task.id));
        const toColumn = columns.find(col => col.statusValue === newStatus);

        if (fromColumn && toColumn) {
          fromColumn.tasks = fromColumn.tasks.filter(t => t.id !== task.id);
          task.status = newStatus;
          toColumn.tasks.push(task);
          this.columns.set([...columns]);
        }
        this.draggingTask.set(null);
      },
      error: (err) => {
        this.error.set('Failed to update task status');
        this.draggingTask.set(null);
        console.error('Error updating task status:', err);
      }
    });
  }

  onDragEnd(): void {
    this.draggingTask.set(null);
  }

  onColumnHover(columnId: string): void {
    this.hoveredColumnId.set(columnId);
  }

  onColumnLeave(): void {
    this.hoveredColumnId.set(null);
  }

  openAddTaskModal(column: Column): void {
    this.selectedColumnForTask.set(column);
    this.showTaskModal.set(true);
  }

  closeTaskModal(): void {
    this.showTaskModal.set(false);
    this.selectedColumnForTask.set(null);
  }

  onTaskSubmit(task: Task): void {
    const project = this.selectedProject();
    const phase = this.selectedPhase();
    const column = this.selectedColumnForTask();

    if (!project || !phase || !column) return;

    // Set the status to the column's status value
    task.status = column.statusValue;

    const url = `${environment.apiUrl}/project/${project.projectId}/phases/${phase.phaseId}/tasks`;

    this.http.post<TaskResponse>(url, task).subscribe({
      next: () => {
        this.loadTasksForPhase(phase);
        this.closeTaskModal();
      },
      error: (err) => {
        this.error.set('Failed to create task');
        console.error('Error creating task:', err);
      }
    });
  }

  getGetPrefilledTask(): Task {
    const column = this.selectedColumnForTask();
    const phase = this.selectedPhase();
    if (!column) {
      return {
        taskName: '',
        description: '',
        startDate: '',
        endDate: '',
        status: 'TO_DO',
        priority: 'Medium',
        projectPhaseId: phase?.phaseId
      };
    }

    return {
      taskName: '',
      description: '',
      startDate: '',
      endDate: '',
      status: column.statusValue,
      priority: 'Medium',
      projectPhaseId: phase?.phaseId
    };
  }

  onTaskCardClick(task: TaskCard): void {
    const phase = this.selectedPhase();
    if (!phase) return;

    this.selectedTaskForDetails.set({
      taskId: task.id as number,
      phaseId: phase.phaseId
    });
    this.showTaskDetailsModal.set(true);
  }

  closeTaskDetailsModal(): void {
    this.showTaskDetailsModal.set(false);
    this.selectedTaskForDetails.set(null);
  }

  onTaskDetailsUpdated(): void {
    // Reload tasks for the current phase to reflect changes
    const phase = this.selectedPhase();
    if (phase) {
      this.loadTasksForPhase(phase);
    }
  }

  getPlaceholderArray(currentTaskCount: number): number[] {
    const maxTasks = this.maxTaskCount();
    const placeholdersNeeded = Math.max(0, maxTasks - currentTaskCount);
    return Array(placeholdersNeeded).fill(0);
  }
}
