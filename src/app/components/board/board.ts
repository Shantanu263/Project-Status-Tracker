import { ChangeDetectionStrategy, Component, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { SelectedProjectService } from '../../services/selected-project.service';
import { ProjectService } from '../../services/project.service';
import { ProjectStateService } from '../../services/project-state.service';
import { MatIconModule } from '@angular/material/icon';
import { TaskFormComponent } from '../phases/task-form/task-form';
import { TaskDetailsModalComponent } from '../phases/task-details-modal/task-details-modal';
import { Task } from '../../models/phase.model';
import { ProjectMember } from '../../models/project.model';
import { DataSyncService } from '../../services/data-sync.service';
import { PermissionService } from '../../services/permission.service';
import { AuthService } from '../../services/auth.service';

type TaskStatus = 'TO_DO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';

interface TaskResponse {
  taskId: number;
  taskName: string;
  description: string;
  startDate: string;
  endDate: string;
  status: TaskStatus;
  priority: string;
  assignedToProjectMemberId: number;
  subTasks?: SubTask[];
  //assignedTo: number;
}

interface SubTask {
  subTaskId: number;
  subTaskName: string;
  status: 'TO_DO' | 'IN_PROGRESS' | 'DONE' | 'REVIEW';
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
  startDate: string;
  dueDate: string;
  assignees: { initials: string; name: string }[];
  assignedToProjectMemberId?: number;
  status: TaskStatus;
  subTasks?: SubTask[];
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
  private readonly projectStateService = inject(ProjectStateService);
  private readonly dataSyncService = inject(DataSyncService);
  private readonly permissionService = inject(PermissionService);
  private readonly authService = inject(AuthService);

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

  // Calculate dynamic column height based on task count
  columnHeight = computed(() => {
    const maxTasks = this.maxTaskCount();
    const BASE_HEIGHT = 325; // Default height for 3 or fewer tasks
    const TASK_INCREMENT = 85; // Height increase per task beyond 3

    if (maxTasks <= 3) {
      return BASE_HEIGHT;
    }

    // For each task beyond 3, add 95px
    return BASE_HEIGHT + ((maxTasks - 3) * TASK_INCREMENT);
  });

  // Permission: can user update tasks (drag to different columns)
  canUpdateTask = computed(() => {
    const currentUserId = this.authService.getCurrentUserId();
    return this.permissionService.canUpdateTask(this.projectMembers(), currentUserId);
  });

  // Track the last loaded project to avoid unnecessary reloads
  private lastLoadedProjectId = signal<number | null>(null);

  constructor() {
    effect(() => {
      const project = this.selectedProject();
      const currentProjectId = project?.projectId ?? null;
      const lastProjectId = this.lastLoadedProjectId();

      // Only reset and reload if the project actually changed
      if (currentProjectId !== lastProjectId) {
        this.resetBoardState();
        if (project) {
          this.lastLoadedProjectId.set(project.projectId);
          this.loadPhases();
          this.loadProjectMembers();
        } else {
          this.lastLoadedProjectId.set(null);
        }
      }
    }, { allowSignalWrites: true });

    // Subscribe to phase updates from other components
    this.dataSyncService.phasesUpdated$.subscribe(projectId => {
      const currentProject = this.selectedProject();
      if (currentProject && projectId === currentProject.projectId) {
        this.loadPhases();
      }
    });

    // Subscribe to task updates from other components
    this.dataSyncService.tasksUpdated$.subscribe(({ projectId, phaseId }) => {
      const currentProject = this.selectedProject();
      const currentPhase = this.selectedPhase();
      if (currentProject && projectId === currentProject.projectId && currentPhase && phaseId === currentPhase.phaseId) {
        this.loadTasksForPhase(currentPhase);
      }
    });

    // Subscribe to project member updates from other components
    this.dataSyncService.projectMembersUpdated$.subscribe(projectId => {
      const currentProject = this.selectedProject();
      if (currentProject && projectId === currentProject.projectId) {
        this.loadProjectMembers();
      }
    });
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
          // Try to restore previously selected phase from session storage
          const savedPhaseId = this.projectStateService.getSelectedPhaseId(project.projectId);
          let phaseToSelect: PhaseResponse;

          if (savedPhaseId) {
            // Validate that the saved phase still exists
            const savedPhase = sortedPhases.find(p => p.phaseId === savedPhaseId);
            if (savedPhase) {
              phaseToSelect = savedPhase;
            } else {
              // Saved phase no longer exists, fall back to first phase
              phaseToSelect = sortedPhases[0];
              // Clear the invalid saved phase
              this.projectStateService.clearSelectedPhase(project.projectId);
            }
          } else {
            // No saved phase, use first phase
            phaseToSelect = sortedPhases[0];
          }

          this.selectedPhase.set(phaseToSelect);
          this.loadTasksForPhase(phaseToSelect);
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

    // Save selected phase to session storage
    const project = this.selectedProject();
    if (project) {
      this.projectStateService.setSelectedPhaseId(project.projectId, phaseId);
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
        startDate: task.startDate,
        dueDate: task.endDate,
        status: taskStatus,
        assignees: [], // Will be populated if member info is available
        subTasks: task.subTasks || []
      };

      // Try to find member from already loaded project members
      if (task.assignedToProjectMemberId) {
        const member = this.projectMembers().find(m => {
          // Handle both string and number types for memberId
          const memberIdNum = typeof m.memberId === 'string' ? parseInt(m.memberId, 10) : m.memberId;
          return memberIdNum === task.assignedToProjectMemberId;
        });

        if (member) {
          taskCard.assignees = [{ initials: this.getInitials(member.user), name: member.user }];
        }
        taskCard.assignedToProjectMemberId = task.assignedToProjectMemberId;
      }

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

  // Check if a member is inactive (removed from project)
  isMemberRemoved(memberId?: number): boolean {
    if (!memberId) return false;
    const member = this.projectMembers().find(m => Number(m.memberId) === memberId);
    return member ? !member.isActive : false;
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
        // Notify other components that tasks have been updated
        this.dataSyncService.notifyTasksUpdated(project.projectId, phase.phaseId);
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
        // Notify other components that tasks have been updated
        this.dataSyncService.notifyTasksUpdated(project.projectId, phase.phaseId);
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

  formatDate(dateString: string): string {
    if (!dateString) return '—';

    try {
      // Handle dd-mm-yyyy format from backend
      const parts = dateString.split('-');
      if (parts.length === 3) {
        // Convert dd-mm-yyyy to yyyy-mm-dd for Date constructor
        const [day, month, year] = parts;
        const date = new Date(`${year}-${month}-${day}`);

        // Check if date is valid
        if (isNaN(date.getTime())) {
          return '—';
        }

        return date.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
      }

      // Fallback: try parsing as-is
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return '—';
      }

      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return '—';
    }
  }

  /**
   * Calculate duration info for a task based on its due date
   * Returns duration string, state, text color, circle color, circumference, dashOffset, and tooltip
   */
  getDurationInfo(dueDate: string, startDate: string): {
    text: string;
    state: 'normal' | 'warning' | 'overdue';
    textColor: string;
    circleColor: string;
    fillPercentage: number;
    tooltip: string;
    show: boolean;
  } {
    if (!dueDate) {
      return { text: '', state: 'normal', textColor: '', circleColor: '', fillPercentage: 0, tooltip: '', show: false };
    }

    try {
      // Parse the due date (dd-mm-yyyy format)
      const dueParts = dueDate.split('-');
      if (dueParts.length !== 3) {
        return { text: '', state: 'normal', textColor: '', circleColor: '', fillPercentage: 0, tooltip: '', show: false };
      }

      const [dueDay, dueMonth, dueYear] = dueParts;
      const dueDateObj = new Date(`${dueYear}-${dueMonth}-${dueDay}`);

      if (isNaN(dueDateObj.getTime())) {
        return { text: '', state: 'normal', textColor: '', circleColor: '', fillPercentage: 0, tooltip: '', show: false };
      }

      // Parse start date if available for calculating fill percentage
      let startDateObj: Date | null = null;
      if (startDate) {
        const startParts = startDate.split('-');
        if (startParts.length === 3) {
          const [startDay, startMonth, startYear] = startParts;
          startDateObj = new Date(`${startYear}-${startMonth}-${startDay}`);
          if (isNaN(startDateObj.getTime())) {
            startDateObj = null;
          }
        }
      }

      // Get current date at midnight for accurate day calculation
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      dueDateObj.setHours(0, 0, 0, 0);
      if (startDateObj) {
        startDateObj.setHours(0, 0, 0, 0);
      }

      // Calculate difference in milliseconds
      const diffMs = dueDateObj.getTime() - now.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      // Calculate fill percentage (0-100)
      let fillPercentage = 0;
      if (startDateObj) {
        const totalDuration = dueDateObj.getTime() - startDateObj.getTime();
        const elapsed = now.getTime() - startDateObj.getTime();
        if (totalDuration > 0) {
          fillPercentage = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
        }
      } else {
        // If no start date, estimate based on time remaining
        if (diffDays <= 0) {
          fillPercentage = 100; // Overdue or today = full
        } else if (diffDays <= 7) {
          fillPercentage = 70; // Near deadline
        } else {
          fillPercentage = 30; // Plenty of time
        }
      }

      // Create tooltip with end date
      const formattedDueDate = this.formatDate(dueDate);
      const baseTooltip = `Due: ${formattedDueDate}`;

      // Determine state, text, and circle color based on days remaining
      // Red: overdue or very close (0-2 days)
      // Yellow: closer (3-7 days)
      // Green: plenty of time (>7 days)
      if (diffDays < 0) {
        // Overdue - Red circle
        const overdueDays = Math.abs(diffDays);
        return {
          text: this.formatDurationText(overdueDays, true),
          state: 'overdue',
          textColor: 'text-red-600',
          circleColor: '#ef4444', // red-500
          fillPercentage: 100, // Always full for overdue
          tooltip: `Overdue | ${baseTooltip}`,
          show: true
        };
      } else if (diffDays <= 2) {
        // Very close (0-2 days) - Red circle
        return {
          text: diffDays === 0 ? 'Today' : this.formatDurationText(diffDays, false),
          state: 'overdue',
          textColor: 'text-red-600',
          circleColor: '#ef4444', // red-500
          fillPercentage: Math.max(fillPercentage, diffDays === 0 ? 95 : 85),
          tooltip: diffDays === 0 ? `Due today | ${baseTooltip}` : `Due very soon | ${baseTooltip}`,
          show: true
        };
      } else if (diffDays <= 7) {
        // Closer (3-7 days) - Yellow/Amber circle
        return {
          text: this.formatDurationText(diffDays, false),
          state: 'warning',
          textColor: 'text-amber-600',
          circleColor: '#f59e0b', // amber-500
          fillPercentage,
          tooltip: `Due soon | ${baseTooltip}`,
          show: true
        };
      } else {
        // Plenty of time (>7 days) - Green circle
        return {
          text: this.formatDurationText(diffDays, false),
          state: 'normal',
          textColor: 'text-green-600',
          circleColor: '#22c55e', // green-500
          fillPercentage,
          tooltip: `On track | ${baseTooltip}`,
          show: true
        };
      }
    } catch {
      return { text: '', state: 'normal', textColor: '', circleColor: '', fillPercentage: 0, tooltip: '', show: false };
    }
  }

  /**
   * Generate SVG path for circular pie slice
   * @param fillPercentage - Percentage filled (0-100)
   * @returns SVG path string for the pie slice
   */
  getPieSlicePath(fillPercentage: number): string {
    const centerX = 16;
    const centerY = 16;
    const radius = 14;

    // Clamp fillPercentage between 0 and 100
    const percentage = Math.max(0, Math.min(100, fillPercentage));

    // If 100%, return full circle
    if (percentage >= 100) {
      return `M ${centerX} ${centerY} m -${radius} 0 a ${radius} ${radius} 0 1 1 ${radius * 2} 0 a ${radius} ${radius} 0 1 1 -${radius * 2} 0`;
    }

    // If 0%, return empty path
    if (percentage <= 0) {
      return '';
    }

    // Calculate angle in radians (starting from top, going clockwise)
    // We start at -90 degrees (top) and go clockwise
    const startAngle = -Math.PI / 2; // -90 degrees (top)
    const endAngle = startAngle + (percentage / 100) * 2 * Math.PI;

    // Calculate end point on circle
    const endX = centerX + radius * Math.cos(endAngle);
    const endY = centerY + radius * Math.sin(endAngle);

    // Large arc flag: 1 if angle > 180 degrees, 0 otherwise
    const largeArcFlag = percentage > 50 ? 1 : 0;

    // Create path: Move to center, line to start point, arc to end point, close path
    return `M ${centerX} ${centerY} L ${centerX} ${centerY - radius} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
  }

  /**
   * Format duration text for display with combined units
   * Uses combinations like: 1w4d, 3m2w, 1y2m
   */
  private formatDurationText(days: number, isOverdue: boolean): string {
    if (days === 0) {
      return 'Today';
    }

    const absDays = Math.abs(days);
    let result = '';

    // Calculate years, months, weeks, and remaining days
    if (absDays >= 365) {
      const years = Math.floor(absDays / 365);
      const remainingDays = absDays % 365;
      const months = Math.floor(remainingDays / 30);

      result = `${years}y`;
      if (months > 0) {
        result += `${months}m`;
      }
    } else if (absDays >= 30) {
      const months = Math.floor(absDays / 30);
      const remainingDays = absDays % 30;
      const weeks = Math.floor(remainingDays / 7);

      result = `${months}m`;
      if (weeks > 0) {
        result += `${weeks}w`;
      }
    } else if (absDays >= 7) {
      const weeks = Math.floor(absDays / 7);
      const remainingDays = absDays % 7;

      result = `${weeks}w`;
      if (remainingDays > 0) {
        result += `${remainingDays}d`;
      }
    } else {
      // Less than a week, just show days
      result = `${absDays}d`;
    }

    return result;
  }

  /**
   * Get subtask status tooltip
   * Returns formatted string like "2/5 subtasks completed"
   */
  getSubtaskTooltip(subTasks: SubTask[] | undefined): string {
    if (!subTasks || subTasks.length === 0) {
      return '';
    }

    const completed = subTasks.filter(st => st.status === 'DONE').length;
    const total = subTasks.length;

    return `${completed}/${total} subtask${total !== 1 ? 's' : ''} completed`;
  }

  /**
   * Check if task has subtasks
   */
  hasSubtasks(task: TaskCard): boolean {
    return task.subTasks !== undefined && task.subTasks !== null && task.subTasks.length > 0;
  }
}
