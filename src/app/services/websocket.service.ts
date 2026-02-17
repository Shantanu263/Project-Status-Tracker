import { Injectable, inject } from '@angular/core';
import { Client, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Subject, BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class WebSocketService {
    private authService = inject(AuthService);
    private client: Client | null = null;
    private messageSubject = new Subject<any>();
    private connectionStatusSubject = new BehaviorSubject<boolean>(false);
    private subscription: StompSubscription | null = null;
    private reconnectAttempts = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 5;
    private readonly RECONNECT_DELAY = 3000;

    messages$ = this.messageSubject.asObservable();
    connectionStatus$ = this.connectionStatusSubject.asObservable();

    connect(): void {
        if (this.client?.connected) {
            console.log('[WebSocket] Already connected');
            return;
        }

        const token = this.authService.getToken();
        if (!token) {
            console.error('[WebSocket] No auth token available for WebSocket connection');
            return;
        }

        // Extract base URL and construct WebSocket URL
        const wsUrl = environment.apiUrl.replace('http', 'ws').replace('/api', '/ws');
        console.log('[WebSocket] Connecting to:', wsUrl);
        console.log('[WebSocket] Using token:', token.substring(0, 20) + '...');


        this.client = new Client({
            webSocketFactory: () => new SockJS(wsUrl),
            connectHeaders: {
                Authorization: `Bearer ${token}`
            },
            debug: (str) => {
                console.log('[STOMP Debug]:', str);
            },
            reconnectDelay: this.RECONNECT_DELAY,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,
            onConnect: () => {
                console.log('[WebSocket] ✅ Connected successfully');
                this.connectionStatusSubject.next(true);
                this.reconnectAttempts = 0;
                this.subscribeToNotifications();
            },
            onStompError: (frame) => {
                console.error('[WebSocket] ❌ STOMP error:', frame);
                this.connectionStatusSubject.next(false);
            },
            onWebSocketClose: () => {
                console.log('[WebSocket] Connection closed');
                this.connectionStatusSubject.next(false);
                this.handleReconnect();
            },
            onWebSocketError: (error) => {
                console.error('[WebSocket] ❌ WebSocket error:', error);
                this.connectionStatusSubject.next(false);
            }
        });

        this.client.activate();
    }

    private subscribeToNotifications(): void {
        if (!this.client?.connected) {
            console.error('[WebSocket] Cannot subscribe: WebSocket not connected');
            return;
        }

        this.subscription = this.client.subscribe('/user/queue/notifications', (message) => {
            try {
                const notification = JSON.parse(message.body);
                console.log('[WebSocket] 📩 Received notification:', notification);
                this.messageSubject.next(notification);
            } catch (error) {
                console.error('[WebSocket] Error parsing notification message:', error);
            }
        });

        console.log('[WebSocket] ✅ Subscribed to /user/queue/notifications');
    }

    private handleReconnect(): void {
        if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
            console.error('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`);

        setTimeout(() => {
            this.connect();
        }, this.RECONNECT_DELAY * this.reconnectAttempts);
    }

    disconnect(): void {
        if (this.subscription) {
            this.subscription.unsubscribe();
            this.subscription = null;
        }

        if (this.client) {
            this.client.deactivate();
            this.client = null;
        }

        this.connectionStatusSubject.next(false);
        console.log('WebSocket disconnected');
    }

    isConnected(): boolean {
        return this.client?.connected || false;
    }
}
