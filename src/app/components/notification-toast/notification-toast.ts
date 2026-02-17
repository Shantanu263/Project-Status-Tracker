import {
    ChangeDetectionStrategy,
    Component,
    inject,
    signal,
    OnInit,
    OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../services/notification.service';
import { Notification, NotificationType } from '../../models/notification.model';
import { Subject, takeUntil } from 'rxjs';
import {
    LucideAngularModule,
    Bell,
    X,
    AlertTriangle,
    ListTodo,
    Folder,
    Calendar
} from 'lucide-angular';

interface ToastNotification extends Notification {
    visible: boolean;
}

@Component({
    selector: 'app-notification-toast',
    imports: [CommonModule, LucideAngularModule],
    templateUrl: './notification-toast.html',
    styleUrl: './notification-toast.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationToastComponent implements OnInit, OnDestroy {
    private notificationService = inject(NotificationService);
    private destroy$ = new Subject<void>();

    // Icons
    Bell = Bell;
    X = X;
    AlertTriangle = AlertTriangle;
    ListTodo = ListTodo;
    Folder = Folder;
    Calendar = Calendar;

    toasts = signal<ToastNotification[]>([]);

    ngOnInit(): void {
        this.notificationService.newNotification$.pipe(takeUntil(this.destroy$)).subscribe((notification) => {
            this.showToast(notification);
        });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private showToast(notification: Notification): void {
        const toast: ToastNotification = {
            ...notification,
            visible: true
        };

        // Add to toasts
        this.toasts.update((toasts) => [...toasts, toast]);

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            this.dismissToast(toast.id);
        }, 5000);
    }

    dismissToast(id: number): void {
        this.toasts.update((toasts) => {
            const index = toasts.findIndex((t) => t.id === id);
            if (index !== -1) {
                const updated = [...toasts];
                updated[index] = { ...updated[index], visible: false };
                // Remove after animation completes
                setTimeout(() => {
                    this.toasts.update((current) => current.filter((t) => t.id !== id));
                }, 300);
                return updated;
            }
            return toasts;
        });
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
}
