import { Component, input, ChangeDetectionStrategy, AfterViewInit, signal, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProjectService } from '../../services/project.service';
import { SelectedProjectService } from '../../services/selected-project.service';
import { DashboardData } from '../../models/dashboard.model';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements AfterViewInit {
  private projectService = inject(ProjectService);
  private selectedProjectService = inject(SelectedProjectService);

  projectName = input<string>('Project Dashboard');
  projectStatus = input<string>('Active');

  dashboardData = signal<DashboardData | null>(null);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  constructor() {
    // Watch for selected project changes and fetch dashboard data
    effect(() => {
      const selectedProject = this.selectedProjectService.selectedProject();
      if (selectedProject?.projectId) {
        this.loadDashboardData(selectedProject.projectId);
      }
    });
  }

  ngAfterViewInit() {
    // Charts will be initialized after data is loaded
  }

  private loadDashboardData(projectId: number) {
    this.loading.set(true);
    this.error.set(null);

    this.projectService.getDashboardData(projectId).subscribe({
      next: (data) => {
        // Sort phases by phaseId in ascending order
        if (data.phaseProgress && data.phaseProgress.length > 0) {
          data.phaseProgress.sort((a, b) => a.phaseId - b.phaseId);
        }

        this.dashboardData.set(data);
        this.loading.set(false);

        // Use requestAnimationFrame to ensure DOM is ready and visible
        requestAnimationFrame(() => {
          setTimeout(() => this.initializeCharts(), 100);
        });
      },
      error: (err) => {
        this.error.set('Failed to load dashboard data');
        this.loading.set(false);
        console.error('Error loading dashboard data:', err);
      }
    });
  }

  private initializeCharts() {
    const data = this.dashboardData();
    if (!data) return;

    // Load Chart.js if not already loaded
    if (typeof (window as any).Chart === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
      script.onload = () => this.renderCharts();
      document.head.appendChild(script);
    } else {
      this.renderCharts();
    }
  }

  private renderCharts() {
    const Chart = (window as any).Chart;
    const data = this.dashboardData();
    if (!data) return;

    // Check if at least one canvas is visible before rendering
    const canvasCheck = document.getElementById('taskDistributionChart') as HTMLCanvasElement;
    if (!canvasCheck || canvasCheck.offsetParent === null) {
      // Canvas not visible yet, retry after a short delay
      setTimeout(() => this.renderCharts(), 100);
      return;
    }

    // Task Distribution Chart
    const taskDistributionCanvas = document.getElementById('taskDistributionChart') as HTMLCanvasElement & { chart?: any };
    if (taskDistributionCanvas) {
      // Destroy existing chart if it exists
      if (taskDistributionCanvas.chart) {
        taskDistributionCanvas.chart.destroy();
      }

      Chart.defaults.font.family = "'Inter', sans-serif";
      Chart.defaults.color = '#6B7280';

      const taskDistributionCtx = taskDistributionCanvas.getContext('2d');
      const labels = data.taskDistribution.map(item => this.formatTaskLabel(item.label));
      const counts = data.taskDistribution.map(item => item.count);

      taskDistributionCanvas.chart = new Chart(taskDistributionCtx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: counts,
            backgroundColor: this.getTaskDistributionColors(data.taskDistribution.length),
            borderColor: this.getTaskDistributionBorderColors(data.taskDistribution.length),
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                padding: 15,
                font: { size: 12 }
              }
            },
            tooltip: {
              callbacks: {
                label: function (context: any) {
                  const label = context.label || '';
                  const value = context.parsed || 0;
                  const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                  const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                  return `${label}: ${value} tasks (${percentage}%)`;
                }
              }
            }
          }
        }
      });
    }

    // Phase Completion Chart
    const phaseCompletionCanvas = document.getElementById('phaseCompletionChart') as HTMLCanvasElement & { chart?: any };
    if (phaseCompletionCanvas) {
      if (phaseCompletionCanvas.chart) {
        phaseCompletionCanvas.chart.destroy();
      }

      const phaseCompletionCtx = phaseCompletionCanvas.getContext('2d');
      const phaseLabels = data.phaseProgress.map(phase => phase.phaseName);
      const phaseData = data.phaseProgress.map(phase => phase.percentComplete);

      phaseCompletionCanvas.chart = new Chart(phaseCompletionCtx, {
        type: 'bar',
        data: {
          labels: phaseLabels,
          datasets: [{
            label: 'Completion %',
            data: phaseData,
            backgroundColor: phaseData.map(value =>
              value === 100 ? 'rgba(34, 197, 94, 0.7)' :
                value > 0 ? 'rgba(59, 130, 246, 0.7)' :
                  'rgba(156, 163, 175, 0.5)'
            ),
            borderColor: phaseData.map(value =>
              value === 100 ? 'rgb(34, 197, 94)' :
                value > 0 ? 'rgb(59, 130, 246)' :
                  'rgb(156, 163, 175)'
            ),
            borderWidth: 2,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: {
                callback: function (value: any) {
                  return value + '%';
                }
              },
              grid: {
                color: 'rgba(156, 163, 175, 0.1)'
              }
            },
            x: {
              grid: {
                display: false
              }
            }
          },
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: function (context: any) {
                  return 'Completion: ' + context.parsed.y.toFixed(1) + '%';
                }
              }
            }
          }
        }
      });
    }

    // Tasks Over Time Chart
    const tasksOverTimeCanvas = document.getElementById('tasksOverTimeChart') as HTMLCanvasElement & { chart?: any };
    if (tasksOverTimeCanvas) {
      if (tasksOverTimeCanvas.chart) {
        tasksOverTimeCanvas.chart.destroy();
      }

      const tasksOverTimeCtx = tasksOverTimeCanvas.getContext('2d');
      const timeLabels = data.tasksOverTime.map(item => this.formatDate(item.date));
      const completedCounts = data.tasksOverTime.map(item => item.completed);

      tasksOverTimeCanvas.chart = new Chart(tasksOverTimeCtx, {
        type: 'line',
        data: {
          labels: timeLabels,
          datasets: [{
            label: 'Tasks Completed',
            data: completedCounts,
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4,
            fill: true,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: 'rgb(59, 130, 246)',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1
              },
              grid: {
                color: 'rgba(156, 163, 175, 0.1)'
              }
            },
            x: {
              grid: {
                display: false
              }
            }
          },
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: function (context: any) {
                  return 'Completed: ' + context.parsed.y + ' tasks';
                }
              }
            }
          }
        }
      });
    }

    // Priority Distribution Chart
    const priorityDistributionCanvas = document.getElementById('priorityDistributionChart') as HTMLCanvasElement & { chart?: any };
    if (priorityDistributionCanvas) {
      if (priorityDistributionCanvas.chart) {
        priorityDistributionCanvas.chart.destroy();
      }

      const priorityDistributionCtx = priorityDistributionCanvas.getContext('2d');
      const priorityLabels = data.priorityDistribution.map(item => item.priority);
      const priorityCounts = data.priorityDistribution.map(item => item.count);

      priorityDistributionCanvas.chart = new Chart(priorityDistributionCtx, {
        type: 'doughnut',
        data: {
          labels: priorityLabels,
          datasets: [{
            data: priorityCounts,
            backgroundColor: this.getPriorityColors(priorityLabels),
            borderColor: this.getPriorityBorderColors(priorityLabels),
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                padding: 15,
                font: { size: 12 }
              }
            },
            tooltip: {
              callbacks: {
                label: function (context: any) {
                  const label = context.label || '';
                  const value = context.parsed || 0;
                  const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                  const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                  return `${label}: ${value} tasks (${percentage}%)`;
                }
              }
            }
          }
        }
      });
    }
  }

  // Helper method to format task labels
  private formatTaskLabel(label: string): string {
    const labelMap: { [key: string]: string } = {
      'TODO': 'To Do',
      'IN_PROGRESS': 'In Progress',
      'REVIEW': 'Review',
      'DONE': 'Completed'
    };
    return labelMap[label] || label;
  }

  // Helper method to format dates
  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Helper method to get task distribution colors
  private getTaskDistributionColors(count: number): string[] {
    const colors = [
      'rgba(59, 130, 246, 0.8)',   // Blue - TODO
      'rgba(251, 191, 36, 0.8)',   // Yellow - IN_PROGRESS
      'rgba(251, 146, 60, 0.8)',   // Orange - REVIEW
      'rgba(34, 197, 94, 0.8)'     // Green - DONE
    ];
    return colors.slice(0, count);
  }

  private getTaskDistributionBorderColors(count: number): string[] {
    const colors = [
      'rgb(59, 130, 246)',
      'rgb(251, 191, 36)',
      'rgb(251, 146, 60)',
      'rgb(34, 197, 94)'
    ];
    return colors.slice(0, count);
  }

  // Helper method to get priority colors
  private getPriorityColors(priorities: string[]): string[] {
    return priorities.map(priority => {
      switch (priority.toLowerCase()) {
        case 'critical': return 'rgba(239, 68, 68, 0.8)';
        case 'high': return 'rgba(251, 146, 60, 0.8)';
        case 'medium': return 'rgba(251, 191, 36, 0.8)';
        case 'low': return 'rgba(156, 163, 175, 0.8)';
        default: return 'rgba(156, 163, 175, 0.8)';
      }
    });
  }

  private getPriorityBorderColors(priorities: string[]): string[] {
    return priorities.map(priority => {
      switch (priority.toLowerCase()) {
        case 'critical': return 'rgb(239, 68, 68)';
        case 'high': return 'rgb(251, 146, 60)';
        case 'medium': return 'rgb(251, 191, 36)';
        case 'low': return 'rgb(156, 163, 175)';
        default: return 'rgb(156, 163, 175)';
      }
    });
  }

  // Helper method to get initials from name
  getInitials(name: string): string {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // Helper method to get deadline color based on days left
  getDeadlineColor(daysLeft: number): string {
    if (daysLeft <= 2) return 'red';
    if (daysLeft <= 5) return 'yellow';
    if (daysLeft <= 7) return 'blue';
    return 'gray';
  }
}
