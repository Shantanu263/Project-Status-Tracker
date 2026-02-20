import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-project-meta-bar',
    imports: [CommonModule],
    templateUrl: './project-meta-bar.html',
    styleUrl: './project-meta-bar.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectMetaBarComponent {
    // Input signals
    startDate = input<string>('');
    endDate = input<string>('');
    status = input<string>('');
    priority = input<string>('');
    client = input<string>('');
    completedOn = input<string>('');

    // Computed signals for formatted dates
    formattedStartDate = computed(() => this.formatDate(this.startDate()));
    formattedEndDate = computed(() => this.formatDate(this.endDate()));

    // Computed completion status for COMPLETED projects or overdue non-completed ones
    completionStatus = computed(() => {
        const status = this.status().toUpperCase();
        const endDateStr = this.endDate();
        const completedOnStr = this.completedOn();

        const parseDate = (str: string): Date | null => {
            if (!str) return null;
            const parts = str.trim().split(/[-\/]/);
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
        };

        const formatDays = (days: number): string => {
            if (days < 7) return `${days}d`;
            const weeks = Math.floor(days / 7);
            const rem = days % 7;
            return rem > 0 ? `${weeks}w ${rem}d` : `${weeks}w`;
        };

        if (status === 'COMPLETED') {
            const endDate = parseDate(endDateStr);
            const completedDate = parseDate(completedOnStr);
            if (completedDate && endDate) {
                completedDate.setHours(0, 0, 0, 0);
                endDate.setHours(0, 0, 0, 0);
                if (completedDate <= endDate) {
                    const earlyDays = Math.floor((endDate.getTime() - completedDate.getTime()) / 86400000);
                    if (earlyDays > 0) {
                        return { label: `${formatDays(earlyDays)} early`, color: 'text-green-600' };
                    }
                    return { label: 'On time', color: 'text-green-600' };
                } else {
                    const lateDays = Math.ceil((completedDate.getTime() - endDate.getTime()) / 86400000);
                    return { label: `+${formatDays(lateDays)} late`, color: 'text-red-600' };
                }
            }
            return null;
        } else {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const endDate = parseDate(endDateStr);
            if (endDate) {
                endDate.setHours(0, 0, 0, 0);
                if (today > endDate) {
                    const overdueDays = Math.ceil((today.getTime() - endDate.getTime()) / 86400000);
                    return { label: `Overdue ${formatDays(overdueDays)}`, color: 'text-orange-600' };
                }
                return { label: 'On Time', color: 'text-green-600' };
            }
            return null;
        }
    });

    // Format date as "01 Jan 2025" from "dd-mm-yyyy" format
    private formatDate(dateString: string): string {
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

    // Get status color classes for badge
    getStatusColor(status: string): string {
        const statusUpper = status?.toUpperCase() || '';
        switch (statusUpper) {
            case 'OPEN':
                return 'bg-gray-100 text-gray-700';
            case 'ONGOING':
                return 'bg-blue-100 text-blue-700';
            case 'ON_HOLD':
                return 'bg-yellow-100 text-yellow-700';
            case 'COMPLETED':
                return 'bg-green-100 text-green-700';
            case 'CANCELLED':
                return 'bg-red-100 text-red-700';
            default:
                return 'bg-gray-100 text-gray-700';
        }
    }

    // Get priority color classes for badge
    getPriorityColor(priority: string): string {
        const priorityLower = priority.toLowerCase();
        switch (priorityLower) {
            case 'high':
                return 'bg-red-100 text-red-700';
            case 'medium':
                return 'bg-yellow-100 text-yellow-700';
            case 'low':
                return 'bg-gray-100 text-gray-700';
            default:
                return 'bg-gray-100 text-gray-700';
        }
    }

    // Format status label (convert ON_HOLD to "On Hold", etc.)
    getStatusLabel(text: string): string {
        if (!text) return '';
        // Replace underscores with spaces and capitalize each word
        return text
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }
}
