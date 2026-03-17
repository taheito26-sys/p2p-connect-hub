// ─── Realtime Polling Engine ────────────────────────────────────────
// Uses the existing /api/merchant/poll endpoint + notification count
// Provides event-driven updates without page refresh

import { notifications, poll } from '@/lib/api';
import type { MerchantInvite, MerchantMessage } from '@/types/domain';

type RealtimeListener = (event: RealtimeEvent) => void;

export interface RealtimeEvent {
  type: 'new_message' | 'new_invite' | 'invite_update' | 'notification_count' | 'deal_update' | 'approval_update';
  data: unknown;
}

class RealtimeEngine {
  private listeners = new Set<RealtimeListener>();
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private notifInterval: ReturnType<typeof setInterval> | null = null;
  private lastPollTime: string;
  private _unreadCount = 0;
  private _isRunning = false;

  constructor() {
    this.lastPollTime = new Date(Date.now() - 60000).toISOString();
  }

  get unreadCount() { return this._unreadCount; }
  get isRunning() { return this._isRunning; }

  subscribe(listener: RealtimeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: RealtimeEvent) {
    this.listeners.forEach(fn => {
      try { fn(event); } catch (e) { console.error('Realtime listener error:', e); }
    });
  }

  start() {
    if (this._isRunning) return;
    this._isRunning = true;

    // Poll for messages/invites every 10s
    this.pollInterval = setInterval(() => this.doPoll(), 10000);

    // Check notification count every 15s
    this.notifInterval = setInterval(() => this.checkNotifications(), 15000);

    // Initial checks
    this.doPoll();
    this.checkNotifications();
  }

  stop() {
    this._isRunning = false;
    if (this.pollInterval) { clearInterval(this.pollInterval); this.pollInterval = null; }
    if (this.notifInterval) { clearInterval(this.notifInterval); this.notifInterval = null; }
  }

  private async doPoll() {
    try {
      const result = await poll.changes(this.lastPollTime);
      this.lastPollTime = new Date().toISOString();

      if (result.messages?.length > 0) {
        this.emit({ type: 'new_message', data: result.messages });
      }
      if (result.invites?.length > 0) {
        for (const inv of result.invites) {
          this.emit({ type: inv.status === 'pending' ? 'new_invite' : 'invite_update', data: inv });
        }
      }
    } catch {
      // Silently ignore poll failures
    }
  }

  private async checkNotifications() {
    try {
      const { unread } = await notifications.count();
      if (unread !== this._unreadCount) {
        this._unreadCount = unread;
        this.emit({ type: 'notification_count', data: unread });
      }
    } catch {
      // Silently ignore
    }
  }
}

// Singleton
export const realtime = new RealtimeEngine();
