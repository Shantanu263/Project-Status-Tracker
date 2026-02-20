export enum NotificationType {
    OVERDUE = 'OVERDUE',
    TASK_ASSIGNED = 'TASK_ASSIGNED',
    TASK_COMPLETED = 'TASK_COMPLETED',
    PHASE_COMPLETED = 'PHASE_COMPLETED',
    PROJECT_UPDATE = 'PROJECT_UPDATE',
    COMMENT = 'COMMENT',
    MENTION = 'MENTION'
}

export enum EntityType {
    TASK = 'TASK',
    SUBTASK = 'SUBTASK',
    PHASE = 'PHASE',
    PROJECT = 'PROJECT'
}

export interface Notification {
    id: number;
    userId: number;
    title: string;
    message: string;
    createdAt: string;
    isRead: boolean;
    type: NotificationType;
    entityId: number;
    entityType: EntityType;
    projectId: number;
    projectName: string;
}

export interface NotificationGroup {
    date: string;
    label: string;
    notifications: Notification[];
}
