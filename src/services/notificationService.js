/**
 * Notification service for managing global and system notifications
 */
import { supabase } from '../lib/supabaseClient';

/**
 * Get unread notification count for current user
 */
export async function getUnreadNotificationCount(userId) {
  try {
    const { count, error } = await supabase
      .from('notification_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)
      .eq('is_archived', false);

    if (error) {
      console.error('[notificationService] Error getting unread count:', error);
      throw error;
    }

    return count || 0;
  } catch (error) {
    console.error('[notificationService] Error getting unread count:', error);
    return 0;
  }
}

/**
 * Get all notifications for current user (excluding archived)
 */
export async function getUserNotifications(userId, options = {}) {
  try {
    const {
      includeRead = true,
      includeArchived = false,
      limit = 100,
      offset = 0,
    } = options;

    let query = supabase
      .from('notification_recipients')
      .select(`
        *,
        notification:notifications (
          id,
          title,
          message,
          youtube_url,
          type,
          system_event_type,
          related_order_id,
          created_at,
          metadata
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false, foreignTable: 'notifications' })
      .limit(limit)
      .range(offset, offset + limit - 1);

    if (!includeRead) {
      query = query.eq('is_read', false);
    }

    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[notificationService] Error getting user notifications:', error);
      throw error;
    }

    // Transform the data to flatten notification fields
    return (data || []).map((recipient) => ({
      id: recipient.notification.id,
      recipientId: recipient.id,
      title: recipient.notification.title,
      message: recipient.notification.message,
      youtubeUrl: recipient.notification.youtube_url,
      type: recipient.notification.type,
      systemEventType: recipient.notification.system_event_type,
      relatedOrderId: recipient.notification.related_order_id,
      createdAt: recipient.notification.created_at,
      metadata: recipient.notification.metadata || {},
      isRead: recipient.is_read,
      readAt: recipient.read_at,
      isDismissed: recipient.is_dismissed,
      dismissedAt: recipient.dismissed_at,
      isArchived: recipient.is_archived,
      archivedAt: recipient.archived_at,
    }));
  } catch (error) {
    console.error('[notificationService] Error getting user notifications:', error);
    throw error;
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(recipientId, userId) {
  try {
    const { data, error } = await supabase
      .from('notification_recipients')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', recipientId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[notificationService] Error marking notification as read:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[notificationService] Error marking notification as read:', error);
    throw error;
  }
}

/**
 * Mark all notifications as read for user
 */
export async function markAllNotificationsAsRead(userId) {
  try {
    const { data, error } = await supabase
      .from('notification_recipients')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('is_read', false)
      .select();

    if (error) {
      console.error('[notificationService] Error marking all as read:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[notificationService] Error marking all as read:', error);
    throw error;
  }
}

/**
 * Dismiss notification (archive it so it doesn't show in any filter)
 */
export async function dismissNotification(recipientId, userId) {
  try {
    const { data, error } = await supabase
      .from('notification_recipients')
      .update({
        is_dismissed: true,
        dismissed_at: new Date().toISOString(),
        is_archived: true, // Also archive so it doesn't show in any filter
        archived_at: new Date().toISOString(),
      })
      .eq('id', recipientId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[notificationService] Error dismissing notification:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[notificationService] Error dismissing notification:', error);
    throw error;
  }
}

/**
 * Archive notification
 */
export async function archiveNotification(recipientId, userId) {
  try {
    const { data, error } = await supabase
      .from('notification_recipients')
      .update({
        is_archived: true,
        archived_at: new Date().toISOString(),
      })
      .eq('id', recipientId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[notificationService] Error archiving notification:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[notificationService] Error archiving notification:', error);
    throw error;
  }
}

/**
 * Create system notification (called by order service when events occur)
 */
export async function createSystemNotification({
  title,
  message,
  systemEventType,
  relatedOrderId,
  relatedUserId,
  metadata = {},
}) {
  try {
    // Call the Supabase function to create system notification
    const { data, error } = await supabase.rpc('create_system_notification', {
      p_title: title,
      p_message: message,
      p_system_event_type: systemEventType,
      p_related_order_id: relatedOrderId || null,
      p_related_user_id: relatedUserId,
      p_metadata: metadata,
    });

    if (error) {
      console.error('[notificationService] Error creating system notification:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[notificationService] Error creating system notification:', error);
    throw error;
  }
}

// ==================== ADMIN FUNCTIONS ====================

/**
 * Get all global notifications (admin only)
 */
export async function getAllGlobalNotifications(options = {}) {
  try {
    const { status, limit = 100, offset = 0 } = options;

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('type', 'global')
      .order('created_at', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[notificationService] Error getting global notifications:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('[notificationService] Error getting global notifications:', error);
    throw error;
  }
}

/**
 * Create global notification (admin only)
 */
export async function createGlobalNotification({
  title,
  message,
  youtubeUrl,
  audience,
  sendAt,
  expireAt,
  isSticky,
  allowDismiss,
  status,
  createdByAdminId,
}) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert([
        {
          title,
          message,
          youtube_url: youtubeUrl || null,
          type: 'global',
          audience: audience || 'all',
          send_at: sendAt || null,
          expire_at: expireAt || null,
          is_sticky: isSticky || false,
          allow_dismiss: allowDismiss !== false, // Default true
          status: status || 'draft',
          created_by_admin_id: createdByAdminId || null,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('[notificationService] Error creating global notification:', error);
      throw error;
    }

    // If status is 'published' or 'scheduled' and send_at is now or in the past, create recipients
    if ((status === 'published' || status === 'scheduled') && (!sendAt || new Date(sendAt) <= new Date())) {
      await supabase.rpc('create_global_notification_recipients', {
        p_notification_id: data.id,
        p_audience: audience || 'all',
      });
    }

    return data;
  } catch (error) {
    console.error('[notificationService] Error creating global notification:', error);
    throw error;
  }
}

/**
 * Update global notification (admin only)
 */
export async function updateGlobalNotification(notificationId, updates) {
  try {
    const updatePayload = {
      updated_at: new Date().toISOString(),
    };

    if (updates.title !== undefined) updatePayload.title = updates.title;
    if (updates.message !== undefined) updatePayload.message = updates.message;
    if (updates.youtubeUrl !== undefined) updatePayload.youtube_url = updates.youtubeUrl;
    if (updates.audience !== undefined) updatePayload.audience = updates.audience;
    if (updates.sendAt !== undefined) updatePayload.send_at = updates.sendAt;
    if (updates.expireAt !== undefined) updatePayload.expire_at = updates.expireAt;
    if (updates.isSticky !== undefined) updatePayload.is_sticky = updates.isSticky;
    if (updates.allowDismiss !== undefined) updatePayload.allow_dismiss = updates.allowDismiss;
    if (updates.status !== undefined) updatePayload.status = updates.status;

    const { data, error } = await supabase
      .from('notifications')
      .update(updatePayload)
      .eq('id', notificationId)
      .eq('type', 'global')
      .select()
      .single();

    if (error) {
      console.error('[notificationService] Error updating global notification:', error);
      throw error;
    }

    // If status changed to 'published' or 'scheduled', create recipients if needed
    if ((updates.status === 'published' || updates.status === 'scheduled') && data.send_at && new Date(data.send_at) <= new Date()) {
      // Check if recipients already exist
      const { count } = await supabase
        .from('notification_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('notification_id', notificationId);

      if (count === 0) {
        await supabase.rpc('create_global_notification_recipients', {
          p_notification_id: notificationId,
          p_audience: data.audience || 'all',
        });
      }
    }

    return data;
  } catch (error) {
    console.error('[notificationService] Error updating global notification:', error);
    throw error;
  }
}

/**
 * Delete global notification (admin only)
 */
export async function deleteGlobalNotification(notificationId) {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('type', 'global');

    if (error) {
      console.error('[notificationService] Error deleting global notification:', error);
      throw error;
    }
  } catch (error) {
    console.error('[notificationService] Error deleting global notification:', error);
    throw error;
  }
}

/**
 * Auto-archive old notifications (run periodically)
 * Archives:
 * - Promos older than 30 days
 * - Transactional notifications older than 90 days
 */
export async function autoArchiveOldNotifications() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Archive promo notifications older than 30 days
    const { error: promoError } = await supabase
      .from('notification_recipients')
      .update({
        is_archived: true,
        archived_at: new Date().toISOString(),
      })
      .eq('is_archived', false)
      .in('notification_id', 
        supabase
          .from('notifications')
          .select('id')
          .eq('type', 'global')
          .lt('created_at', thirtyDaysAgo.toISOString())
      );

    if (promoError) {
      console.error('[notificationService] Error archiving promo notifications:', promoError);
    }

    // Archive transactional notifications older than 90 days
    const { error: transactionalError } = await supabase
      .from('notification_recipients')
      .update({
        is_archived: true,
        archived_at: new Date().toISOString(),
      })
      .eq('is_archived', false)
      .in('notification_id',
        supabase
          .from('notifications')
          .select('id')
          .eq('type', 'system')
          .lt('created_at', ninetyDaysAgo.toISOString())
      );

    if (transactionalError) {
      console.error('[notificationService] Error archiving transactional notifications:', transactionalError);
    }
  } catch (error) {
    console.error('[notificationService] Error auto-archiving notifications:', error);
    throw error;
  }
}

