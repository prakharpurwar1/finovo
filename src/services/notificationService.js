/**
 * Finovo In-App & Multi-Channel Notification Service
 * Manages persistent notifications, real-time channels, and split expense dispatch.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabaseClient.js';
import { formatCurrency, fromPaise } from '../utils/currency.js';

const LOCAL_NOTIFICATIONS_KEY = 'finovo_notifications_store';

function getLocalNotifications(userId) {
  try {
    const raw = localStorage.getItem(`${LOCAL_NOTIFICATIONS_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalNotifications(userId, list) {
  try {
    localStorage.setItem(`${LOCAL_NOTIFICATIONS_KEY}_${userId}`, JSON.stringify(list));
  } catch (e) {
    console.warn('Error saving local notifications', e);
  }
}

export const notificationService = {
  /**
   * Fetches all in-app notifications for the authenticated user.
   */
  async fetchUserNotifications(userId) {
    if (!userId) return { data: [], unreadCount: 0, error: null };

    if (!isSupabaseConfigured()) {
      const items = getLocalNotifications(userId);
      const unreadCount = items.filter(n => !n.is_read).length;
      return { data: items, unreadCount, error: null };
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const unreadCount = (data || []).filter(n => !n.is_read).length;
      return { data: data || [], unreadCount, error: null };
    } catch (err) {
      console.warn('Error fetching notifications from Supabase, using local store:', err);
      const items = getLocalNotifications(userId);
      return { data: items, unreadCount: items.filter(n => !n.is_read).length, error: err.message };
    }
  },

  /**
   * Marks a single notification as read.
   */
  async markAsRead(notificationId, userId) {
    if (!notificationId) return;

    if (!isSupabaseConfigured()) {
      const items = getLocalNotifications(userId);
      const updated = items.map(n => n.id === notificationId ? { ...n, is_read: true } : n);
      setLocalNotifications(userId, updated);
      return;
    }

    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', userId);
    } catch (err) {
      console.warn('Error marking notification as read:', err);
    }
  },

  /**
   * Marks all notifications as read for the user.
   */
  async markAllAsRead(userId) {
    if (!userId) return;

    if (!isSupabaseConfigured()) {
      const items = getLocalNotifications(userId);
      const updated = items.map(n => ({ ...n, is_read: true }));
      setLocalNotifications(userId, updated);
      return;
    }

    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);
    } catch (err) {
      console.warn('Error marking all notifications as read:', err);
    }
  },

  /**
   * Dispatches notifications to all relevant participants when a split expense is created/updated.
   */
  async dispatchSplitExpenseCreated({ group, expense, shares = [], actorName = 'A member' }) {
    if (!group || !expense) return;

    for (const share of shares) {
      // Find recipient member details
      const member = (group.members || []).find(m => m.id === share.memberId);
      if (!member) continue;

      const amountFormatted = formatCurrency(fromPaise(share.allocatedSharePaise || 0));
      const totalFormatted = formatCurrency(expense.amount || fromPaise(expense.amount_paise));
      const message = `${actorName} added "${expense.title}" in ${group.name}. Your share: ${amountFormatted} of ${totalFormatted}.`;

      // 1. In-App Notification (for registered members)
      if (member.user_id) {
        const notifPayload = {
          id: `notif_${Date.now()}_${member.user_id}`,
          user_id: member.user_id,
          group_id: group.id,
          expense_id: expense.id,
          event_type: 'expense_created',
          title: `New Expense in ${group.name}`,
          message,
          is_read: false,
          created_at: new Date().toISOString()
        };

        if (isSupabaseConfigured()) {
          supabase.from('notifications').insert(notifPayload).catch(() => {});
        } else {
          const existing = getLocalNotifications(member.user_id);
          setLocalNotifications(member.user_id, [notifPayload, ...existing]);
        }
      }

      // 2. Multi-Channel SMS (for unregistered members or opted-in SMS users)
      if (member.phone) {
        this.triggerSmsNotification({
          recipientPhone: member.phone,
          recipientName: member.name,
          message: `Finovo: ${actorName} added shared expense "${expense.title}" in group "${group.name}". Your share is ${amountFormatted}. View at ${typeof window !== 'undefined' && window.location ? window.location.origin : 'https://finovo.app'}`,
          groupId: group.id,
          idempotencyKey: `sms_exp_${expense.id}_${member.id}`
        }).catch(() => {});
      }
    }
  },

  /**
   * Dispatches notification when a settlement is recorded.
   */
  async dispatchSettlementRecorded({ group, settlement, payerName, recipientMember }) {
    if (!group || !settlement) return;

    const amountFormatted = formatCurrency(fromPaise(settlement.amount_paise || 0));
    const message = `${payerName} recorded a payment of ${amountFormatted} to you in ${group.name}.`;

    if (recipientMember?.user_id) {
      const notifPayload = {
        id: `notif_${Date.now()}_${recipientMember.user_id}`,
        user_id: recipientMember.user_id,
        group_id: group.id,
        settlement_id: settlement.id,
        event_type: 'settlement_recorded',
        title: `Settlement in ${group.name}`,
        message,
        is_read: false,
        created_at: new Date().toISOString()
      };

      if (isSupabaseConfigured()) {
        supabase.from('notifications').insert(notifPayload).catch(() => {});
      } else {
        const existing = getLocalNotifications(recipientMember.user_id);
        setLocalNotifications(recipientMember.user_id, [notifPayload, ...existing]);
      }
    }

    if (recipientMember?.phone) {
      this.triggerSmsNotification({
        recipientPhone: recipientMember.phone,
        recipientName: recipientMember.name,
        message: `Finovo: ${payerName} recorded a settlement of ${amountFormatted} in "${group.name}". Check your balance at ${window.location.origin}`,
        groupId: group.id,
        idempotencyKey: `sms_set_${settlement.id}_${recipientMember.id}`
      }).catch(() => {});
    }
  },

  /**
   * Triggers secure backend SMS delivery via /api/sms.
   */
  async triggerSmsNotification({ recipientPhone, recipientName, message, groupId, idempotencyKey }) {
    if (!recipientPhone) return;

    try {
      const response = await fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientPhone,
          recipientName,
          message,
          groupId,
          idempotencyKey
        })
      });

      const result = await response.json().catch(() => ({}));
      return result;
    } catch (err) {
      console.warn('SMS dispatch network error:', err);
      return { success: false, status: 'failed', error: err.message };
    }
  }
};
