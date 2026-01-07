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

    // Computed signals for formatted dates
    formattedStartDate = computed(() => this.formatDate(this.startDate()));
    formattedEndDate = computed(() => this.formatDate(this.endDate()));

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
        const statusLower = status.toLowerCase();
        switch (statusLower) {
            case 'ongoing':
                return 'bg-blue-100 text-blue-700';
            case 'completed':
                return 'bg-green-100 text-green-700';
            case 'on hold':
                return 'bg-yellow-100 text-yellow-700';
            case 'delayed':
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

    // Capitalize first letter
    capitalize(text: string): string {
        if (!text) return '';
        return text.charAt(0).toUpperCase() + text.slice(1);
    }
}
