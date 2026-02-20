import { Injectable, inject, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, forkJoin, of } from 'rxjs';
import { tap, switchMap, map, catchError } from 'rxjs/operators';
import { environment } from '../environments/environment';
import { Notification } from '../models/notification.model';
import { WebSocketService } from './websocket.service';
import { AuthService } from './auth.service';
import { ProjectService } from './project.service';

@Injectable({
    providedIn: 'root'
})
export class NotificationService implements OnDestroy {
    private http = inject(HttpClient);
    private webSocketService = inject(WebSocketService);
    private authService = inject(AuthService);
    private projectService = inject(ProjectService);
    private apiUrl = `${environment.apiUrl}/auth/user`;

    private notificationsSubject = new BehaviorSubject<Notification[]>([]);
    private unreadCountSubject = new BehaviorSubject<number>(0);
    private newNotificationSubject = new Subject<Notification>();

    notifications$ = this.notificationsSubject.asObservable();
    unreadCount$ = this.unreadCountSubject.asObservable();
    newNotification$ = this.newNotificationSubject.asObservable();

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
        console.log('[NotificationService] Handling new notification:', notification);

        // Fetch project name if projectId exists
        if (notification.projectId) {
            this.projectService.getProjectById(notification.projectId).pipe(
                catchError(err => {
                    console.error('[NotificationService] Error fetching project for new notification:', err);
                    return of(null);
                })
            ).subscribe(project => {
                // Enrich notification with project name
                const enrichedNotification = {
                    ...notification,
                    projectName: project?.projectName || 'Unknown Project'
                };

                // Add to the beginning of the notifications list
                const currentNotifications = this.notificationsSubject.value;
                this.notificationsSubject.next([enrichedNotification, ...currentNotifications]);

                // Increment unread count
                const currentCount = this.unreadCountSubject.value;
                this.unreadCountSubject.next(currentCount + 1);

                // Emit for toast notification
                this.newNotificationSubject.next(enrichedNotification);
            });
        } else {
            // No project ID, add notification as-is
            const currentNotifications = this.notificationsSubject.value;
            this.notificationsSubject.next([notification, ...currentNotifications]);

            // Increment unread count
            const currentCount = this.unreadCountSubject.value;
            this.unreadCountSubject.next(currentCount + 1);

            // Emit for toast notification
            this.newNotificationSubject.next(notification);
        }
    }

    fetchNotifications(page: number = 0, size: number = 10): Observable<Notification[]> {
        const userId = this.authService.getCurrentUserId();
        if (!userId) {
            console.error('[NotificationService] No user ID available');
            return of([]);
        }

        const url = `${this.apiUrl}/${userId}/notifications?page=${page}&size=${size}`;
        console.log('[NotificationService] Fetching notifications from:', url);

        return this.http.get<Notification[]>(url).pipe(
            switchMap((notifications) => {
                console.log('[NotificationService] Received notifications:', notifications);

                // Extract unique project IDs
                const projectIds = [...new Set(notifications.map(n => n.projectId).filter(id => id != null))];

                if (projectIds.length === 0) {
                    // No projects to fetch
                    this.notificationsSubject.next(notifications);
                    return of(notifications);
                }

                console.log('[NotificationService] Fetching project names for IDs:', projectIds);

                // Fetch all projects
                const projectRequests = projectIds.map(id =>
                    this.projectService.getProjectById(id).pipe(
                        catchError(err => {
                            console.error(`[NotificationService] Error fetching project ${id}:`, err);
                            return of(null);
                        })
                    )
                );

                return forkJoin(projectRequests).pipe(
                    map(projects => {
                        // Create a map of projectId to projectName
                        const projectMap = new Map<number, string>();
                        projects.forEach(project => {
                            if (project && project.projectId) {
                                projectMap.set(project.projectId, project.projectName || 'Unknown Project');
                            }
                        });

                        console.log('[NotificationService] Project map:', projectMap);

                        // Enrich notifications with project names
                        const enrichedNotifications = notifications.map(notification => ({
                            ...notification,
                            projectName: projectMap.get(notification.projectId) || 'Unknown Project'
                        }));

                        console.log('[NotificationService] Enriched notifications:', enrichedNotifications);
                        this.notificationsSubject.next(enrichedNotifications);
                        return enrichedNotifications;
                    })
                );
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
