/**
 * Consent log service for Supabase
 */
import { supabase } from '../lib/supabaseClient';

/**
 * Create a consent log entry
 * @param {Object} logData - Consent log data
 * @param {string} logData.user_id - User ID
 * @param {string} logData.status - Status (pending, approved, denied)
 * @param {string} [logData.channel] - Channel (email, sms, self)
 * @param {string} [logData.contact] - Contact information
 * @param {string} [logData.token] - Consent token
 * @param {string} [logData.approved_at] - Approval timestamp
 * @param {string} [logData.approver_name] - Approver name
 * @returns {Promise<Object>} Created consent log
 */
export async function createConsentLog(logData) {
  try {
    if (__DEV__) {
      console.log('[consent] Creating consent log:', logData.user_id);
    }

    const payload = {
      user_id: logData.user_id,
      status: logData.status || 'approved',
      channel: logData.channel || 'self',
      contact: logData.contact || null,
      token: logData.token || null,
      approved_at: logData.approved_at || (logData.status === 'approved' ? new Date().toISOString() : null),
      approver_name: logData.approver_name || null,
    };

    const { data, error } = await supabase
      .from('consent_logs')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('[consent] Error creating consent log:', error);
      throw error;
    }

    if (__DEV__) {
      console.log('[consent] ✅ Consent log created successfully');
    }

    return data;
  } catch (error) {
    console.error('[consent] Failed to create consent log:', error);
    throw error;
  }
}

/**
 * Get consent logs for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of consent logs
 */
export async function getConsentLogs(userId) {
  try {
    if (__DEV__) {
      console.log('[consent] Fetching consent logs for user:', userId);
    }

    const { data, error } = await supabase
      .from('consent_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[consent] Error fetching consent logs:', error);
      throw error;
    }

    // Transform to match expected format (hide token from public logs)
    const publicLogs = (data || []).map((log) => {
      const { token, ...publicLog } = log;
      return {
        ...publicLog,
        id: log.id,
        userId: log.user_id,
        status: log.status,
        channel: log.channel,
        contact: log.contact,
        createdAt: log.created_at,
        approvedAt: log.approved_at,
        approverName: log.approver_name,
      };
    });

    if (__DEV__) {
      console.log('[consent] ✅ Fetched', publicLogs.length, 'consent logs');
    }

    return publicLogs;
  } catch (error) {
    console.error('[consent] Failed to get consent logs:', error);
    throw error;
  }
}

