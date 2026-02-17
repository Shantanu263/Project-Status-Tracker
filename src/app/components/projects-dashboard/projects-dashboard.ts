import { ChangeDetectionStrategy, Component, signal, inject, computed, ViewChild, ElementRef, AfterViewInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import type { ProjectCard } from '../../models/dashboard.model';

// Register Chart.js components
Chart.register(...registerables);

@Component({
  selector: 'app-projects-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './projects-dashboard.html',
  styleUrl: './projects-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectsDashboard implements AfterViewInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly projectService = inject(ProjectService);

  @ViewChild('statusChart') statusChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('progressDistributionChart') progressDistributionChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('priorityChart') priorityChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('radarChart') radarChartCanvas!: ElementRef<HTMLCanvasElement>;

  private statusChart: Chart | null = null;
  private progressDistributionChart: Chart | null = null;
  private priorityChart: Chart | null = null;
  private radarChart: Chart | null = null;
  private viewInitialized = false;

  // Fetch dashboard data from backend
  private dashboardDataSignal = toSignal(this.projectService.getProjectsDashboard(), {
    initialValue: null
  });

  viewMode = signal<'grid' | 'table'>('grid');

  // Filter state
  showFilterPanel = signal(false);
  filterDateFrom = signal('');
  filterDateTo = signal('');
  filterStatus = signal('');
  filterPriority = signal('');

  // Computed values from backend data
  kpis = computed(() => {
    const data = this.dashboardDataSignal();
    if (!data) return {
      totalProjects: 0,
      activeProjects: 0,
      completedProjects: 0,
      delayedProjects: 0,
      averageProgress: 0
    };

    return {
      totalProjects: data.totalProjects,
      activeProjects: data.activeProjects,
      completedProjects: data.completedProjects,
      delayedProjects: data.delayedProjects,
      averageProgress: Math.round(data.averageProgress)
    };
  });

  projects = computed(() => {
    const data = this.dashboardDataSignal();
    return data?.projectCardDTOS || [];
  });

  statusOptions = computed(() => {
    const data = this.dashboardDataSignal();
    const statusChart = data?.projectStatusChart;
    if (!statusChart?.length) {
      return ['Ongoing', 'Completed', 'Delayed', 'On Hold', 'Not Started'];
    }
    return statusChart.map((item: { status: string }) => item.status);
  });

  filteredProjects = computed(() => {
    const list = this.projects();
    const dateFrom = this.filterDateFrom();
    const dateTo = this.filterDateTo();
    const status = this.filterStatus();
    const priority = this.filterPriority();

    return list.filter(project => {
      if (dateFrom && !this.projectInDateRange(project, dateFrom, null)) return false;
      if (dateTo && !this.projectInDateRange(project, null, dateTo)) return false;
      if (status && this.normalizeStatus(project.status) !== this.normalizeStatus(status)) return false;
      if (priority && (project.priority ?? '').toLowerCase() !== priority.toLowerCase()) return false;
      return true;
    });
  });

  hasActiveFilters = computed(() => {
    return !!(this.filterDateFrom() || this.filterDateTo() || this.filterStatus() || this.filterPriority());
  });

  activeFilterCount = computed(() => {
    let n = 0;
    if (this.filterDateFrom() || this.filterDateTo()) n += 1;
    if (this.filterStatus()) n += 1;
    if (this.filterPriority()) n += 1;
    return n;
  });

  activeFilterSummary = computed(() => {
    const parts: string[] = [];
    const from = this.filterDateFrom();
    const to = this.filterDateTo();
    if (from || to) {
      parts.push('Date: ' + (from || 'any') + ' – ' + (to || 'any'));
    }
    const status = this.filterStatus();
    if (status) parts.push('Status: ' + status);
    const priority = this.filterPriority();
    if (priority) parts.push('Priority: ' + priority);
    return parts.join(' · ');
  });

  hasNoProjects = computed(() => this.projects().length === 0);

  hasFilteredNoResults = computed(() => this.projects().length > 0 && this.filteredProjects().length === 0);

  isLoading = computed(() => this.dashboardDataSignal() === null);

  constructor() {
    // Watch for data changes and create/update charts
    effect(() => {
      const data = this.dashboardDataSignal();
      if (data && this.viewInitialized) {
        // If charts don't exist yet, create them
        if (!this.statusChart || !this.progressDistributionChart || !this.priorityChart || !this.radarChart) {
          setTimeout(() => this.createCharts(data), 0);
        } else {
          // Charts exist, just update them
          this.updateCharts(data);
        }
      }
    }, { allowSignalWrites: true });
  }

  ngAfterViewInit(): void {
    // Mark view as initialized
    this.viewInitialized = true;

    // Try to create charts if data is already available
    const data = this.dashboardDataSignal();
    if (data) {
      setTimeout(() => this.createCharts(data), 0);
    }

    setTimeout(() => document.addEventListener('click', this.boundCloseFilterOnClickOutside), 0);
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.boundCloseFilterOnClickOutside);
    if (this.statusChart) {
      this.statusChart.destroy();
    }
    if (this.progressDistributionChart) {
      this.progressDistributionChart.destroy();
    }
    if (this.priorityChart) {
      this.priorityChart.destroy();
    }
    if (this.radarChart) {
      this.radarChart.destroy();
    }
  }

  private boundCloseFilterOnClickOutside = (event: MouseEvent): void => {
    if (!this.showFilterPanel()) return;
    const panel = document.querySelector('.projects-dashboard-filter-panel');
    const trigger = document.querySelector('.projects-dashboard-filter-trigger');
    const target = event.target as Node;
    if (panel && trigger && !panel.contains(target) && !trigger.contains(target)) {
      this.showFilterPanel.set(false);
    }
  };

  private createCharts(data: any): void {
    this.createStatusChart(data.projectStatusChart);
    this.createProgressDistributionChart(data.projectProgressChart);
    this.createPriorityChart(data.projectPriorityChart);
    this.createRadarChart(data.projectRadarChart);
  }

  private updateCharts(data: any): void {
    if (this.statusChart && data.projectStatusChart) {
      this.statusChart.data.labels = data.projectStatusChart.map((item: any) => item.status);
      this.statusChart.data.datasets[0].data = data.projectStatusChart.map((item: any) => item.count);
      this.statusChart.update();

      // Update legend counts
      data.projectStatusChart.forEach((item: any) => {
        const normalizedStatus = item.status.toLowerCase().replace(/\s+/g, '');
        const countElement = document.getElementById(`count-${normalizedStatus}`);
        if (countElement) {
          countElement.textContent = item.count.toString();
        }
      });
    }

    if (this.progressDistributionChart && data.projectProgressChart) {
      this.progressDistributionChart.data.labels = data.projectProgressChart.map((item: any) => item.rangeLabel);
      this.progressDistributionChart.data.datasets[0].data = data.projectProgressChart.map((item: any) => item.projectCount);
      this.progressDistributionChart.update();
    }

    if (this.priorityChart && data.projectPriorityChart) {
      this.priorityChart.data.labels = data.projectPriorityChart.map((item: any) => item.priority);
      this.priorityChart.data.datasets[0].data = data.projectPriorityChart.map((item: any) => item.count);
      this.priorityChart.update();
    }

    if (this.radarChart && data.projectRadarChart) {
      this.radarChart.data.labels = data.projectRadarChart.map((item: any) => item.metric);
      this.radarChart.data.datasets[0].data = data.projectRadarChart.map((item: any) => item.score);
      this.radarChart.update();
    }
  }

  private createStatusChart(statusData: any[]): void {
    if (!this.statusChartCanvas || !statusData || statusData.length === 0) return;

    const ctx = this.statusChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    // Professional color palette for status types
    const getStatusColor = (status: string): string => {
      const normalizedStatus = status.toLowerCase();
      const colors: Record<string, string> = {
        'ongoing': '#3B82F6',      // Blue 500
        'in progress': '#3B82F6',
        'completed': '#10B981',    // Green 500
        'done': '#10B981',
        'delayed': '#EF4444',      // Red 500
        'on hold': '#F59E0B',      // Amber 500
        'at risk': '#F59E0B',
        'not started': '#9CA3AF',  // Gray 400
        'pending': '#9CA3AF'
      };
      return colors[normalizedStatus] || '#9CA3AF';
    };

    // Update legend counts in the HTML
    const updateLegendCounts = () => {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        statusData.forEach(item => {
          const normalizedStatus = item.status.toLowerCase().replace(/\s+/g, '');
          const countElement = document.getElementById(`count-${normalizedStatus}`);
          if (countElement) {
            countElement.textContent = item.count.toString();
          }
        });
      });
    };

    // Call to populate counts
    updateLegendCounts();

    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels: statusData.map(item => item.status),
        datasets: [{
          data: statusData.map(item => item.count),
          backgroundColor: statusData.map(item => getStatusColor(item.status)),
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 6,           // Subtle hover effect
          borderRadius: 4           // Rounded segment edges
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '70%',
        layout: {
          padding: {
            top: 0,
            bottom: 51,
            left: 0,
            right: 0
          }
        },
        plugins: {
          legend: {
            display: false  // Using custom HTML legend on the right
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            cornerRadius: 8,
            titleFont: {
              size: 14,
              weight: 600
            },
            bodyFont: {
              size: 13
            },
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            displayColors: true,
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = context.parsed || 0;
                const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        },
        animation: {
          animateRotate: true,
          animateScale: true,
          duration: 1000,
          easing: 'easeInOutQuart',
          onComplete: () => {
            // Update legend counts after animation completes
            updateLegendCounts();
          }
        }
      },
      plugins: [{
        id: 'centerText',
        beforeDraw: (chart) => {
          const { ctx, chartArea } = chart;
          if (!chartArea) return;

          const centerX = (chartArea.left + chartArea.right) / 2;
          const centerY = (chartArea.top + chartArea.bottom) / 2;
          const total = (chart.data.datasets[0].data as number[]).reduce((a, b) => a + b, 0);

          ctx.save();

          // Draw total count
          ctx.font = 'bold 28px Inter, sans-serif';
          ctx.fillStyle = '#111827';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(total.toString(), centerX, centerY - 12);

          // Draw "Total Projects" label
          ctx.font = '12px Inter, sans-serif';
          ctx.fillStyle = '#6B7280';
          ctx.fillText('Total Projects', centerX, centerY + 15);

          ctx.restore();
        }
      }]
    };

    this.statusChart = new Chart(ctx, config);
  }



  private createProgressDistributionChart(progressData: any[]): void {
    if (!this.progressDistributionChartCanvas || !progressData || progressData.length === 0) return;

    const ctx = this.progressDistributionChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: progressData.map(item => item.rangeLabel),
        datasets: [{
          label: 'Projects',
          data: progressData.map(item => item.projectCount),
          // Professional gradient color for bars
          backgroundColor: 'rgba(99, 102, 241, 0.8)',  // Indigo 500 with opacity
          borderColor: 'rgb(99, 102, 241)',
          borderWidth: 2,
          borderRadius: 6,      // Rounded top corners
          borderSkipped: false  // Apply rounding to all corners
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,  // Allow chart to fill container
        layout: {
          padding: {
            top: 10,
            bottom: 10,
            left: 10,
            right: 10
          }
        },
        plugins: {
          legend: {
            display: false      // No legend needed - self-explanatory
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            cornerRadius: 8,
            titleFont: {
              size: 14,
              weight: 600
            },
            bodyFont: {
              size: 13
            },
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            displayColors: false,
            callbacks: {
              // Clean tooltip showing range and count
              label: (context) => {
                const value = context.parsed.y ?? 0;
                return `${value} ${value === 1 ? 'project' : 'projects'}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'  // Minimal gridlines
            },
            ticks: {
              stepSize: 1,  // Integer counts only
              font: {
                size: 11
              },
              color: '#6B7280',
              padding: 8
            },
            title: {
              display: true,
              text: 'Number of Projects',
              font: {
                size: 12,
                weight: 500
              },
              color: '#6B7280'
            }
          },
          x: {
            grid: {
              display: false     // No vertical gridlines
            },
            ticks: {
              font: {
                size: 12,
                weight: 500
              },
              color: '#374151'
            }
          }
        },
        animation: {
          duration: 1000,
          easing: 'easeInOutQuart'  // Smooth bar growth animation
        }
      }
    };

    this.progressDistributionChart = new Chart(ctx, config);
  }

  //Priority Chart
  private createPriorityChart(priorityData: any[]): void {
    if (!this.priorityChartCanvas || !priorityData || priorityData.length === 0) return;

    const ctx = this.priorityChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    // Map priority levels to semantic colors
    const getPriorityColor = (priority: string): string => {
      const normalizedPriority = priority.toLowerCase();
      const colors: Record<string, string> = {
        'low': '#10B981',      // Green 500
        'medium': '#F59E0B',   // Amber 500
        'high': '#EF4444'      // Red 500
      };
      return colors[normalizedPriority] || '#9CA3AF';
    };

    // Sort data by priority (High -> Medium -> Low) for better visualization
    const sortedData = [...priorityData].sort((a, b) => {
      const order = { 'High': 0, 'Medium': 1, 'Low': 2 };
      return order[a.priority as keyof typeof order] - order[b.priority as keyof typeof order];
    });

    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: sortedData.map(item => item.priority),
        datasets: [{
          label: 'Projects',
          data: sortedData.map(item => item.count),
          // Apply semantic colors to each bar
          backgroundColor: sortedData.map(item => getPriorityColor(item.priority)),
          borderColor: sortedData.map(item => getPriorityColor(item.priority).replace(')', ', 1)')),
          borderWidth: 2,
          borderRadius: 8,      // Rounded bar ends
          borderSkipped: false,
          barThickness: 24      // Compact bar thickness
        }]
      },
      options: {
        indexAxis: 'y',         // Horizontal bars
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: 10,
            bottom: 10,
            left: 30,
            right: 10
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            cornerRadius: 8,
            titleFont: {
              size: 14,
              weight: 600
            },
            bodyFont: {
              size: 13
            },
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            displayColors: false,
            callbacks: {
              label: (context) => {
                const value = context.parsed.x ?? 0;
                return `${value} ${value === 1 ? 'project' : 'projects'}`;
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
              stepSize: 1,
              font: {
                size: 11
              },
              color: '#6B7280',
              padding: 8
            },
            title: {
              display: true,
              text: 'Number of Projects',
              font: {
                size: 12,
                weight: 500
              },
              color: '#6B7280'
            }
          },
          y: {
            grid: {
              display: false     // No horizontal gridlines
            },
            ticks: {
              font: {
                size: 12,
                weight: 600
              },
              color: '#374151',
              padding: 1,  // Reduced padding for closer alignment
              align: 'start' as const,  // Left align labels
              crossAlign: 'near' as const
            }
          }
        },
        animation: {
          duration: 1000,
          easing: 'easeInOutQuart'
        }
      },
      plugins: [{
        id: 'coloredSquares',
        afterDraw: (chart) => {
          const { ctx, scales } = chart;
          const yScale = scales['y'];

          if (!yScale) return;

          ctx.save();

          // Draw colored squares before each label
          yScale.ticks.forEach((tick, index) => {
            const label = yScale.getLabelForValue(tick.value);
            const color = getPriorityColor(label);
            const y = yScale.getPixelForValue(tick.value);

            // Draw square
            const squareSize = 10;
            const x = yScale.left - 10;  // Position closer to labels

            ctx.fillStyle = color;
            ctx.fillRect(x - squareSize / 2, y - squareSize / 2, squareSize, squareSize);
          });

          ctx.restore();
        }
      }]
    };

    this.priorityChart = new Chart(ctx, config);
  }

  private createRadarChart(radarData: any[]): void {
    if (!this.radarChartCanvas || !radarData || radarData.length === 0) return;

    const ctx = this.radarChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const config: ChartConfiguration<'radar'> = {
      type: 'radar',
      data: {
        labels: radarData.map(item => item.metric),
        datasets: [
          {
            label: 'Current Performance',
            data: radarData.map(item => item.score),
            backgroundColor: 'rgba(99, 102, 241, 0.2)',
            borderColor: 'rgb(99, 102, 241)',
            borderWidth: 2,
            pointBackgroundColor: 'rgb(99, 102, 241)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgb(99, 102, 241)',
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Target',
            data: radarData.map(() => 90), // 90% as target baseline
            backgroundColor: 'rgba(209, 213, 219, 0.1)',
            borderColor: 'rgb(209, 213, 219)',
            borderWidth: 2,
            borderDash: [5, 5],
            pointBackgroundColor: 'rgb(209, 213, 219)',
            pointBorderColor: '#fff',
            pointRadius: 3,
            pointHoverRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,  // Allow chart to fill container
        layout: {
          padding: {
            top: 10,
            bottom: 10,
            left: 10,
            right: 10
          }
        },
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            min: 0,
            ticks: {
              stepSize: 20,
              font: {
                size: 10
              },
              color: '#9CA3AF',
              backdropColor: 'transparent'
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)',
              circular: true
            },
            angleLines: {
              color: 'rgba(0, 0, 0, 0.05)'
            },
            pointLabels: {
              font: {
                size: 11,
                weight: 500
              },
              color: '#374151',
              padding: 8
            }
          }
        },
        plugins: {
          legend: {
            display: false // Using custom legend in HTML
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            cornerRadius: 8,
            titleFont: {
              size: 14,
              weight: 600
            },
            bodyFont: {
              size: 13
            },
            callbacks: {
              label: (context) => {
                const datasetLabel = context.dataset.label || '';
                const value = context.parsed.r || 0;
                return `${datasetLabel}: ${value.toFixed(1)}%`;
              }
            }
          }
        },
        animation: {
          duration: 1200,
          easing: 'easeInOutQuart'
        }
      }
    };

    this.radarChart = new Chart(ctx, config);
  }

  toggleView(mode: 'grid' | 'table'): void {
    this.viewMode.set(mode);
  }

  toggleFilterPanel(): void {
    this.showFilterPanel.update(v => !v);
  }

  clearFilters(): void {
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
    this.filterStatus.set('');
    this.filterPriority.set('');
  }

  private parseDate(str: string): Date | null {
    if (!str) return null;
    // Handle dd-mm-yyyy from backend
    const parts = str.trim().split(/[-/]/);
    if (parts.length === 3) {
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      const p2 = parseInt(parts[2], 10);
      if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
        const d = p0 <= 31 && p1 <= 12
          ? new Date(p2, p1 - 1, p0)
          : new Date(p0, p1 - 1, p2);
        if (!isNaN(d.getTime())) return d;
      }
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  private projectInDateRange(project: ProjectCard, from: string | null, to: string | null): boolean {
    const start = this.parseDate(project.startDate);
    const end = this.parseDate(project.endDate);
    if (from) {
      const fromDate = this.parseDate(from);
      if (!fromDate) return true;
      if (end) {
        const fd = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
        const ed = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        if (ed < fd) return false;
      }
    }
    if (to) {
      const toDate = this.parseDate(to);
      if (!toDate) return true;
      if (start) {
        const td = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
        const sd = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        if (sd > td) return false;
      }
    }
    return true;
  }

  private normalizeStatus(s: string): string {
    return s.toLowerCase().replace(/\s+/g, '');
  }

  // Map backend status to frontend status classes
  getStatusClass(status: string): string {
    const normalizedStatus = status.toLowerCase();
    const statusClasses: Record<string, string> = {
      'ongoing': 'bg-blue-100 text-blue-700',
      'in progress': 'bg-blue-100 text-blue-700',
      'completed': 'bg-green-100 text-green-700',
      'done': 'bg-green-100 text-green-700',
      'delayed': 'bg-red-100 text-red-700',
      'on hold': 'bg-yellow-100 text-yellow-700',
      'at risk': 'bg-yellow-100 text-yellow-700',
      'not started': 'bg-gray-100 text-gray-700',
      'pending': 'bg-gray-100 text-gray-700'
    };
    return statusClasses[normalizedStatus] || 'bg-gray-100 text-gray-700';
  }

  getStatusLabel(status: string): string {
    // Return status as-is from backend, just capitalize properly
    return status.split(' ').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  }

  // Map backend status to progress bar colors
  getProgressColor(status: string): string {
    const normalizedStatus = status.toLowerCase();
    const colors: Record<string, string> = {
      'ongoing': 'bg-blue-600',
      'in progress': 'bg-blue-600',
      'completed': 'bg-green-600',
      'done': 'bg-green-600',
      'delayed': 'bg-red-600',
      'on hold': 'bg-yellow-500',
      'at risk': 'bg-yellow-500',
      'not started': 'bg-gray-400',
      'pending': 'bg-gray-400'
    };
    return colors[normalizedStatus] || 'bg-gray-400';
  }

  // Navigation methods
  viewProject(projectId: number): void {
    this.router.navigate(['/home/projects', projectId]);
  }

  viewTimeline(projectId: number): void {
    this.router.navigate(['/home/projects', projectId, 'timeline']);
  }

  viewKanban(projectId: number): void {
    this.router.navigate(['/home/projects', projectId, 'board']);
  }
}
