import { Injectable, inject, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../environments/environment';
import { AuthService } from './auth.service';
import { WebSocketService } from './websocket.service';
import { Notification } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {
    private http = inject(HttpClient);
    private authService = inject(AuthService);
    private webSocketService = inject(WebSocketService);

    private notificationsSubject = new BehaviorSubject<Notification[]>([]);
    private unreadCountSubject = new BehaviorSubject<number>(0);
    private newNotificationSubject = new Subject<Notification>();

    notifications$ = this.notificationsSubject.asObservable();
    unreadCount$ = this.unreadCountSubject.asObservable();
    newNotification$ = this.newNotificationSubject.asObservable();

    private apiUrl = environment.apiUrl + '/auth/user';

    constructor() {
        console.log('[NotificationService] Initializing...');

        // Connect to WebSocket
        console.log('[NotificationService] Connecting to WebSocket...');
        this.webSocketService.connect();

        // Subscribe to incoming WebSocket messages
        this.webSocketService.messages$.subscribe((notification: Notification) => {
            console.log('[NotificationService] Handling new WebSocket notification:', notification);
            this.handleNewNotification(notification);
        });

        // Initial fetch of notifications and unread count
        const userId = this.authService.getCurrentUserId();
        console.log('[NotificationService] Current user ID:', userId);

        if (userId) {
            console.log('[NotificationService] Fetching initial notifications...');
            this.fetchNotifications(0, 10).subscribe({
                next: (notifications) => console.log('[NotificationService] Initial notifications loaded:', notifications.length),
                error: (err) => console.error('[NotificationService] Error loading initial notifications:', err)
            });

            console.log('[NotificationService] Fetching unread count...');
            this.fetchUnreadCount().subscribe({
                next: (count) => console.log('[NotificationService] Initial unread count:', count),
                error: (err) => console.error('[NotificationService] Error loading unread count:', err)
            });
        }
    }

    private handleNewNotification(notification: Notification): void {
        // Add to the beginning of the notifications list
        const currentNotifications = this.notificationsSubject.value;
        this.notificationsSubject.next([notification, ...currentNotifications]);

        // Increment unread count
        const currentCount = this.unreadCountSubject.value;
        this.unreadCountSubject.next(currentCount + 1);

        // Emit for toast notification
        this.newNotificationSubject.next(notification);
    }

    fetchNotifications(page: number = 0, size: number = 10): Observable<Notification[]> {
        const userId = this.authService.getCurrentUserId();
        if (!userId) {
            console.error('[NotificationService] No user ID available');
            return new Observable();
        }

        const url = `${this.apiUrl}/${userId}/notifications?page=${page}&size=${size}`;
        console.log('[NotificationService] Fetching notifications from:', url);

        return this.http
            .get<Notification[]>(url)
            .pipe(
                tap((notifications) => {
                    console.log('[NotificationService] Received notifications:', notifications);
                    this.notificationsSubject.next(notifications);
                })
            );
    }

    fetchUnreadCount(): Observable<number> {
        const userId = this.authService.getCurrentUserId();
        if (!userId) {
            console.error('No user ID available');
            return new Observable();
        }

        return this.http.get<number>(`${this.apiUrl}/${userId}/notifications/unread-count`).pipe(
            tap((count) => {
                this.unreadCountSubject.next(count);
            })
        );
    }

    markAsRead(notificationId: number): Observable<void> {
        return this.http.put<void>(`${this.apiUrl}/notifications/${notificationId}/read`, {}).pipe(
            tap(() => {
                // Update local state
                const notifications = this.notificationsSubject.value.map((n) =>
                    n.id === notificationId ? { ...n, isRead: true } : n
                );
                this.notificationsSubject.next(notifications);

                // Decrement unread count
                const currentCount = this.unreadCountSubject.value;
                this.unreadCountSubject.next(Math.max(0, currentCount - 1));
            })
        );
    }

    markAllAsRead(): Observable<void> {
        const userId = this.authService.getCurrentUserId();
        if (!userId) {
            console.error('No user ID available');
            return new Observable();
        }

        return this.http.put<void>(`${this.apiUrl}/${userId}/notifications/read`, {}).pipe(
            tap(() => {
                // Update local state - mark all as read
                const notifications = this.notificationsSubject.value.map((n) => ({
                    ...n,
                    isRead: true
                }));
                this.notificationsSubject.next(notifications);

                // Reset unread count
                this.unreadCountSubject.next(0);
            })
        );
    }

    ngOnDestroy(): void {
        this.webSocketService.disconnect();
    }
}
