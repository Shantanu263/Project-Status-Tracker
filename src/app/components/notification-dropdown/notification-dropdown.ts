import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    inject,
    input,
    output,
    signal,
    OnInit,
    OnDestroy,
    HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NotificationService } from '../../services/notification.service';
import { Notification, NotificationType, NotificationGroup } from '../../models/notification.model';
import { Subject, takeUntil } from 'rxjs';
import {
    LucideAngularModule,
    Bell,
    CheckCheck,
    AlertTriangle,
    ListTodo,
    Folder,
    Calendar
} from 'lucide-angular';

@Component({
    selector: 'app-notification-dropdown',
    imports: [CommonModule, LucideAngularModule],
    templateUrl: './notification-dropdown.html',
    styleUrl: './notification-dropdown.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationDropdownComponent implements OnInit, OnDestroy {
    private notificationService = inject(NotificationService);
    private router = inject(Router);
    private destroy$ = new Subject<void>();

    // Icons
    Bell = Bell;
    CheckCheck = CheckCheck;
    AlertTriangle = AlertTriangle;
    ListTodo = ListTodo;
    Folder = Folder;
    Calendar = Calendar;

    isOpen = input<boolean>(false);
    close = output<void>();

    notifications = signal<Notification[]>([]);
    isLoading = signal<boolean>(true);

    groupedNotifications = computed(() => {
        return this.groupNotificationsByDate(this.notifications());
    });

    ngOnInit(): void {
        // Subscribe to notifications
        this.notificationService.notifications$.pipe(takeUntil(this.destroy$)).subscribe((notifications) => {
            this.notifications.set(notifications);
            this.isLoading.set(false);
        });

        // Watch for isOpen changes to refresh notifications
        effect(() => {
            if (this.isOpen()) {
                this.refreshNotifications();
            }
        });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        const dropdown = document.querySelector('.notification-dropdown-panel');
        const bellButton = document.querySelector('.notification-bell-button');

        // Close if click is outside dropdown and not on bell button
        if (
            this.isOpen() &&
            dropdown &&
            !dropdown.contains(target) &&
            bellButton &&
            !bellButton.contains(target)
        ) {
            this.close.emit();
        }
    }

    private refreshNotifications(): void {
        this.isLoading.set(true);
        this.notificationService.fetchNotifications(0, 20).subscribe();
    }

    private groupNotificationsByDate(notifications: Notification[]): NotificationGroup[] {
        const groups: Map<string, Notification[]> = new Map();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        notifications.forEach((notification) => {
            const notificationDate = new Date(notification.createdAt);
            notificationDate.setHours(0, 0, 0, 0);

            let key: string;
            if (notificationDate.getTime() === today.getTime()) {
                key = 'Today';
            } else if (notificationDate.getTime() === yesterday.getTime()) {
                key = 'Yesterday';
            } else {
                key = 'Earlier';
            }

            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(notification);
        });

        const order = ['Today', 'Yesterday', 'Earlier'];
        return order
            .filter((label) => groups.has(label))
            .map((label) => ({
                date: label,
                label: label,
                notifications: groups.get(label)!
            }));
    }

    getRelativeTime(dateString: string): string {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

        return date.toLocaleDateString();
    }

    getNotificationIcon(type: NotificationType): any {
        switch (type) {
            case NotificationType.OVERDUE:
                return this.AlertTriangle;
            case NotificationType.TASK_ASSIGNED:
            case NotificationType.TASK_COMPLETED:
                return this.ListTodo;
            case NotificationType.PHASE_COMPLETED:
                return this.Calendar;
            case NotificationType.PROJECT_UPDATE:
                return this.Folder;
            default:
                return this.Bell;
        }
    }

    onNotificationClick(notification: Notification): void {
        // Mark as read if not already
        if (!notification.isRead) {
            this.notificationService.markAsRead(notification.id).subscribe();
        }

        // Navigate to the entity
        this.navigateToEntity(notification);

        // Close dropdown
        this.close.emit();
    }

    private navigateToEntity(notification: Notification): void {
        // TODO: Implement navigation based on entity type and ID
        // For now, just log the navigation intent
        console.log('Navigate to:', notification.entityType, notification.entityId);

        // Example navigation (adjust based on your routing structure):
        // if (notification.entityType === 'TASK') {
        //   this.router.navigate(['/tasks', notification.entityId]);
        // } else if (notification.entityType === 'PHASE') {
        //   this.router.navigate(['/phases', notification.entityId]);
        // }
    }

    markAllAsRead(): void {
        this.notificationService.markAllAsRead().subscribe();
    }
}
