export type DelayEntityType = 'PHASE' | 'TASK';
export type DelayStatus = 'OPEN' | 'ONGOING' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED';

/** Matches the GET /project/{projectId}/delay-tracker response shape */
export interface DelayLog {
    delayLogId: number;
    projectId: number;
    phaseId: number | null;
    taskId: number | null;
    entityType: DelayEntityType;
    /** Format: dd-MM-yyyy (as returned by the server) */
    originalEndDate: string;
    /** Format: dd-MM-yyyy (as returned by the server) */
    revisedEndDate: string;
    status: DelayStatus;
    assigneeId: number | null;
    reason: string;
}

/** Request body for POST /project/{projectId}/delay-tracker */
export interface CreateDelayLogPayload {
    projectId: number;
    phaseId?: number;
    taskId?: number;
    entityType: DelayEntityType;
    /** Format: yyyy-MM-dd */
    originalEndDate: string;
    /** Format: yyyy-MM-dd */
    revisedEndDate: string;
    status: DelayStatus;
    assigneeId?: number;
    reason: string;
}

/** Request body for PUT /project/{projectId}/delay-tracker/{delayLogId} */
export type UpdateDelayLogPayload = Partial<Omit<CreateDelayLogPayload, 'projectId'>>;

/** Request body for POST /project/{projectId}/delay-tracker/bulk-add */
export interface BulkDelayLogPayload {
    delayLogs: CreateDelayLogPayload[];
}

/** Response from POST /project/{projectId}/delay-tracker/bulk-add */
export interface BulkDelayLogResponse {
    failedEntries: any[];
    message: string;
}

/** Request body for PUT /project/{projectId}/delay-tracker/bulk-update */
export interface BulkUpdateDelayPayload {
    ids: number[];
    updates: Partial<Omit<CreateDelayLogPayload, 'projectId'>>;
}

/** Response from PUT /project/{projectId}/delay-tracker/bulk-update */
export interface BulkUpdateDelayResponse {
    successIds: number[];
    failedItems: any[];
}

/** Request body for DELETE /project/{projectId}/delay-tracker/bulk-delete */
export interface BulkDeleteDelayPayload {
    ids: number[];
}
