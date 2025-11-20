/**
 * Workload Service
 * Manages weekly workload capacity and checks availability
 */

import { supabase } from '../lib/supabaseClient';

/**
 * Get the Monday date of the week for a given date (ISO week start)
 * @param {Date} date - Date to get week start for (defaults to today)
 * @returns {Date} Monday of the week
 */
function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}

/**
 * Format date as YYYY-MM-DD for database
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get next week start date/time set to 9:00 AM PST
 * @param {Date} date - Reference date (defaults to today)
 * @returns {Date} Next Monday at 9:00 AM PST (as a Date object, will be formatted with timezone)
 */
export function getNextWeekStartDateTime(date = new Date()) {
  const nextMonday = getNextWeekStart(date);
  // Return the date - we'll format it with PST/PDT timezone in the formatting functions
  return nextMonday;
}

/**
 * Format next availability date/time for display in PST/PDT
 * Returns format: "Monday, January 15 at 9:00 AM PST"
 * @param {Date} nextWeekStartDate - Date object for next week start (should be a Monday)
 * @returns {string} Formatted date/time string
 */
export function formatNextAvailabilityDateTime(nextWeekStartDate) {
  if (!nextWeekStartDate) return 'soon';
  
  const date = new Date(nextWeekStartDate);
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  // Create a UTC date that represents 9:00 AM PST/PDT
  // PST = UTC-8, PDT = UTC-7
  // We'll use Intl.DateTimeFormat to format in PST/PDT timezone
  // Create a date in UTC that when formatted in PST/PDT will show 9:00 AM
  // Use a Date object and format it with timezone 'America/Los_Angeles'
  
  // Create UTC date for 9 AM PST (17:00 UTC) - we'll let the formatter handle DST
  // Actually, let's use a simpler approach: create a local date and format it in PST/PDT timezone
  const localDate = new Date(year, month, day, 9, 0, 0);
  
  // Format using PST/PDT timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });
  
  // Format the date parts
  const dateParts = formatter.formatToParts(localDate);
  const dayOfWeek = dateParts.find(p => p.type === 'weekday')?.value || 'Monday';
  const monthName = dateParts.find(p => p.type === 'month')?.value || 'January';
  const dayNum = dateParts.find(p => p.type === 'day')?.value || String(day);
  
  // Format the time parts
  const timeParts = timeFormatter.formatToParts(localDate);
  const hour = timeParts.find(p => p.type === 'hour')?.value || '9';
  const minute = timeParts.find(p => p.type === 'minute')?.value || '00';
  const ampm = timeParts.find(p => p.type === 'dayPeriod')?.value || 'AM';
  const tzName = timeParts.find(p => p.type === 'timeZoneName')?.value || 'PST';
  
  return `${dayOfWeek}, ${monthName} ${dayNum} at ${hour}:${minute} ${ampm} ${tzName}`;
}

/**
 * Format next week start for admin display
 * Returns format: "Monday at 9:00 AM PST"
 * @param {Date} nextWeekStartDate - Date object for next week start (should be a Monday)
 * @returns {string} Formatted date/time string
 */
export function formatNextWeekStartForAdmin(nextWeekStartDate) {
  if (!nextWeekStartDate) return 'Monday at 9:00 AM PST';
  
  const date = new Date(nextWeekStartDate);
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  // Create a local date for 9 AM and format it in PST/PDT timezone
  const localDate = new Date(year, month, day, 9, 0, 0);
  
  // Format in PST/PDT timezone
  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'long',
  });
  
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });
  
  const dayOfWeek = dayFormatter.format(localDate);
  const timeParts = timeFormatter.formatToParts(localDate);
  const hour = timeParts.find(p => p.type === 'hour')?.value || '9';
  const minute = timeParts.find(p => p.type === 'minute')?.value || '00';
  const ampm = timeParts.find(p => p.type === 'dayPeriod')?.value || 'AM';
  const tzName = timeParts.find(p => p.type === 'timeZoneName')?.value || 'PST';
  
  return `${dayOfWeek} at ${hour}:${minute} ${ampm} ${tzName}`;
}

/**
 * Get the next Monday (start of next week)
 * @param {Date} date - Reference date (defaults to today)
 * @returns {Date}
 */
export function getNextWeekStart(date = new Date()) {
  const weekStart = getWeekStart(date);
  const nextWeek = new Date(weekStart);
  nextWeek.setDate(nextWeek.getDate() + 7);
  return nextWeek;
}

/**
 * Get or create capacity record for a week
 * @param {Date} weekStart - Monday date of the week
 * @returns {Promise<Object>} Capacity record
 */
async function getOrCreateWeeklyCapacity(weekStart) {
  const weekStartStr = formatDate(weekStart);
  
  try {
    // Call Supabase function to get or create capacity
    const { data, error } = await supabase.rpc('get_or_create_weekly_capacity', {
      target_week_start: weekStartStr,
    });

    if (error) {
      // Check if table doesn't exist (PGRST205)
      if (error.code === 'PGRST205') {
        const tableMissingError = new Error(
          'The workload_capacity table does not exist. Please run the SQL migration script in Supabase: docs/supabase-create-workload-capacity.sql'
        );
        tableMissingError.code = 'PGRST205';
        tableMissingError.details = {
          hint: 'Run the SQL script in Supabase SQL Editor to create the workload_capacity table and functions.',
          migrationScript: 'docs/supabase-create-workload-capacity.sql',
        };
        throw tableMissingError;
      }

      // If RPC doesn't exist or fails for another reason, try direct query/insert
      console.warn('[workloadService] RPC failed, using direct query:', error);
      
      // Try to get existing
      let { data: existing, error: getError } = await supabase
        .from('workload_capacity')
        .select('*')
        .eq('week_start', weekStartStr)
        .single();

      // Check if table doesn't exist in direct query too
      if (getError && getError.code === 'PGRST205') {
        const tableMissingError = new Error(
          'The workload_capacity table does not exist. Please run the SQL migration script in Supabase: docs/supabase-create-workload-capacity.sql'
        );
        tableMissingError.code = 'PGRST205';
        tableMissingError.details = {
          hint: 'Run the SQL script in Supabase SQL Editor to create the workload_capacity table and functions.',
          migrationScript: 'docs/supabase-create-workload-capacity.sql',
        };
        throw tableMissingError;
      }

      if (getError && getError.code === 'PGRST116') {
        // Not found - get latest capacity setting
        const { data: latest } = await supabase
          .from('workload_capacity')
          .select('weekly_capacity')
          .order('week_start', { ascending: false })
          .limit(1)
          .single();

        const defaultCapacity = latest?.weekly_capacity || 50;

        // Create new record
        const { data: newRecord, error: insertError } = await supabase
          .from('workload_capacity')
          .insert({
            week_start: weekStartStr,
            weekly_capacity: defaultCapacity,
            orders_count: 0,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        return newRecord;
      }

      if (getError) throw getError;
      return existing;
    }

    return data;
  } catch (error) {
    console.error('[workloadService] Error getting/creating capacity:', error);
    throw error;
  }
}

/**
 * Get current week's capacity information
 * @returns {Promise<Object>} { weeklyCapacity, ordersCount, remaining, weekStart, nextWeekStart }
 */
export async function getWeeklyCapacity() {
  try {
    const weekStart = getWeekStart();
    const capacity = await getOrCreateWeeklyCapacity(weekStart);
    const nextWeekStart = getNextWeekStart();

    return {
      weeklyCapacity: capacity.weekly_capacity || 50,
      ordersCount: capacity.orders_count || 0,
      remaining: Math.max(0, (capacity.weekly_capacity || 50) - (capacity.orders_count || 0)),
      weekStart: capacity.week_start,
      nextWeekStart: formatDate(nextWeekStart),
      nextWeekStartDate: nextWeekStart,
    };
  } catch (error) {
    console.error('[workloadService] Error getting weekly capacity:', error);
    throw error;
  }
}

/**
 * Check if capacity is available for submission
 * @returns {Promise<Object>} { available, remaining, isAlmostFull, isFull, weekStart, nextWeekStart }
 */
export async function checkCapacityAvailability() {
  try {
    const capacity = await getWeeklyCapacity();
    const { weeklyCapacity, ordersCount, remaining, weekStart, nextWeekStart, nextWeekStartDate } = capacity;
    
    const available = remaining > 0;
    const isAlmostFull = remaining <= 3 && remaining > 0; // Few spots remaining
    const isFull = remaining <= 0;

    return {
      available,
      isAlmostFull,
      isFull,
      remaining,
      weeklyCapacity,
      ordersCount,
      weekStart,
      nextWeekStart,
      nextWeekStartDate,
    };
  } catch (error) {
    console.error('[workloadService] Error checking capacity:', error);
    // On error, allow submission (fail open)
    return {
      available: true,
      isAlmostFull: false,
      isFull: false,
      remaining: 999,
      weeklyCapacity: 50,
      ordersCount: 0,
      weekStart: formatDate(getWeekStart()),
      nextWeekStart: formatDate(getNextWeekStart()),
      nextWeekStartDate: getNextWeekStart(),
    };
  }
}

/**
 * Increment order count for current week
 * Called when an order is submitted
 * @returns {Promise<Object>} Updated capacity info
 */
export async function incrementWeeklyOrders() {
  try {
    const weekStart = getWeekStart();
    const weekStartStr = formatDate(weekStart);

    // Call Supabase function to increment
    const { data, error } = await supabase.rpc('increment_weekly_orders', {
      target_week_start: weekStartStr,
    });

    if (error) {
      // Fallback to direct update
      console.warn('[workloadService] RPC failed, using direct update:', error);
      
      // Get or create capacity
      const capacity = await getOrCreateWeeklyCapacity(weekStart);
      
      // Increment count
      const { data: updated, error: updateError } = await supabase
        .from('workload_capacity')
        .update({ orders_count: (capacity.orders_count || 0) + 1 })
        .eq('week_start', weekStartStr)
        .select()
        .single();

      if (updateError) throw updateError;
      return updated;
    }

    // Reload to get full capacity info
    return await getOrCreateWeeklyCapacity(weekStart);
  } catch (error) {
    console.error('[workloadService] Error incrementing weekly orders:', error);
    throw error;
  }
}

/**
 * Update weekly capacity (admin only)
 * @param {number} capacity - New weekly capacity
 * @returns {Promise<Object>} Updated capacity record
 */
export async function updateWeeklyCapacity(capacity) {
  try {
    if (typeof capacity !== 'number' || capacity < 1) {
      throw new Error('Capacity must be a positive number');
    }

    const weekStart = getWeekStart();
    const weekStartStr = formatDate(weekStart);

    // Get or create capacity record for current week
    await getOrCreateWeeklyCapacity(weekStart);

    // Update capacity (also update future weeks without capacity set)
    const { data, error } = await supabase
      .from('workload_capacity')
      .update({ weekly_capacity: capacity })
      .eq('week_start', weekStartStr)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[workloadService] Error updating weekly capacity:', error);
    throw error;
  }
}

/**
 * Get next availability date string for display
 * @param {Date} nextWeekStart
 * @returns {string} Formatted date string
 */
export function formatNextAvailability(nextWeekStart) {
  if (!nextWeekStart) return 'soon';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextWeek = new Date(nextWeekStart);
  nextWeek.setHours(0, 0, 0, 0);
  
  const daysDiff = Math.ceil((nextWeek - today) / (1000 * 60 * 60 * 24));
  
  if (daysDiff === 0) return 'today';
  if (daysDiff === 1) return 'tomorrow';
  if (daysDiff <= 7) return `in ${daysDiff} days`;
  
  // Format as readable date
  return nextWeek.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: nextWeek.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Reset current week's order count (admin/testing only)
 * This manually resets the orders_count to 0 for the current week
 * @returns {Promise<Object>} Updated capacity record
 */
export async function resetCurrentWeekCount() {
  try {
    const weekStart = getWeekStart();
    const weekStartStr = formatDate(weekStart);

    // Get or create capacity record first
    await getOrCreateWeeklyCapacity(weekStart);

    // Reset count to 0
    const { data, error } = await supabase
      .from('workload_capacity')
      .update({ orders_count: 0, updated_at: new Date().toISOString() })
      .eq('week_start', weekStartStr)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[workloadService] Error resetting week count:', error);
    throw error;
  }
}

/**
 * Force create next week's capacity record (admin/testing only)
 * This simulates moving to the next week for testing purposes
 * @returns {Promise<Object>} Next week's capacity record
 */
export async function createNextWeekCapacity() {
  try {
    const nextWeekStart = getNextWeekStart();
    const nextWeekStartStr = formatDate(nextWeekStart);

    // Get current week's capacity to inherit the setting
    const currentWeek = getWeekStart();
    const currentWeekStr = formatDate(currentWeek);
    
    const { data: currentCapacity } = await supabase
      .from('workload_capacity')
      .select('weekly_capacity')
      .eq('week_start', currentWeekStr)
      .single();

    const capacityToUse = currentCapacity?.weekly_capacity || 50;

    // Check if next week already exists
    const { data: existing } = await supabase
      .from('workload_capacity')
      .select('*')
      .eq('week_start', nextWeekStartStr)
      .single();

    if (existing) {
      // Already exists, just return it
      return existing;
    }

    // Create next week's record with inherited capacity and 0 orders
    const { data, error } = await supabase
      .from('workload_capacity')
      .insert({
        week_start: nextWeekStartStr,
        weekly_capacity: capacityToUse,
        orders_count: 0,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[workloadService] Error creating next week capacity:', error);
    throw error;
  }
}

/**
 * Simulate being in a different week (admin/testing only)
 * This creates a capacity record for a specific week date for testing
 * @param {Date} targetDate - The date to simulate being in
 * @returns {Promise<Object>} Capacity record for that week
 */
export async function simulateWeek(targetDate) {
  try {
    const weekStart = getWeekStart(targetDate);
    return await getOrCreateWeeklyCapacity(weekStart);
  } catch (error) {
    console.error('[workloadService] Error simulating week:', error);
    throw error;
  }
}

