/**
 * Authentication service using Supabase Auth
 * Migrated from local backend to Supabase for production
 */
import { supabase } from '../lib/supabaseClient';
import { upsertProfile, getProfile } from './supabaseService';

/**
 * Sign up a new user
 * @param {Object} payload - Signup data
 * @param {string} payload.email - Email address
 * @param {string} payload.password - Password
 * @param {string} payload.name - Full name
 * @param {string} payload.ageGroup - Age group (13-17, 18-24, etc.)
 * @returns {Promise<Object>} User and session data
 */
export async function signup({ email, password, name, ageGroup, consentAccepted = false }) {
  try {
    if (__DEV__) {
      console.log('[auth] Signing up user:', { email, name, ageGroup });
    }

    // Validate age group
    const validAgeGroups = ['13-17', '18-24', '25-34', '35-44', '45-54', '55+'];
    if (!validAgeGroups.includes(ageGroup)) {
      throw new Error('Invalid age group. You must be 13 years or older.');
    }

    // Validate consent acceptance
    if (!consentAccepted) {
      throw new Error('You must accept the Terms & Conditions and Privacy Policy to create an account.');
    }

    // Sign up with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          age_group: ageGroup,
        },
      },
    });

    if (authError) {
      if (authError.message?.includes('already registered') || authError.message?.includes('already exists')) {
        throw new Error('Account already exists for this email. Try logging in or use "Forgot password".');
      }
      throw authError;
    }

    if (!authData.user) {
      throw new Error('Failed to create user account');
    }

    const userId = authData.user.id;
    const now = new Date().toISOString();

    // IMPORTANT: Ensure the session is properly set in the Supabase client
    // The session from signUp should be available, but we need to verify it's set
    // Supabase automatically persists sessions to AsyncStorage, but we need to ensure
    // the session from signUp is properly set before any RLS-protected operations
    if (authData.session) {
      // Set the session explicitly to ensure it's available for RLS checks
      // This also persists it to AsyncStorage automatically
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
      });
      
      if (sessionError) {
        if (__DEV__) {
          console.error('[auth] ❌ Error setting session:', sessionError.message);
          console.error('[auth] Session error details:', {
            code: sessionError.code,
            message: sessionError.message,
            userId,
          });
        }
        // Don't throw - try to continue, session might still work
      } else {
        // Wait a moment for the session to be fully persisted to AsyncStorage
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Verify session is actually set and available
        const { data: { session: verifiedSession }, error: verifyError } = await supabase.auth.getSession();
        if (verifiedSession) {
          if (__DEV__) {
            console.log('[auth] ✅ Session set and verified, user ID:', verifiedSession.user.id);
          }
        } else {
          if (__DEV__) {
            console.error('[auth] ❌ Session was set but getSession returned null');
            if (verifyError) {
              console.error('[auth] Session verify error:', verifyError.message);
            }
          }
          // This is a problem - session isn't available, which means RLS will block operations
          // Log it prominently but don't throw - profile will be handled on login
        }
      }
    } else {
      if (__DEV__) {
        console.warn('[auth] ⚠️  No session in signUp response');
        console.warn('[auth] This might mean email confirmation is required');
        console.warn('[auth] Profile creation will be handled on first login');
      }
      // If there's no session, we can't create/update the profile now
      // The trigger should create it, and it will be updated on first login
    }

    // Wait for the trigger to create the profile (if it hasn't already)
    // The trigger should create the profile automatically when auth.users is created
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Try to update the profile with consent timestamps and full_name
    // The trigger should have created the profile, so this should be an UPDATE, not INSERT
    try {
      // First, verify we have a session
      const { data: { session }, error: sessionCheckError } = await supabase.auth.getSession();
      
      if (!session) {
        if (__DEV__) {
          console.warn('[auth] ⚠️  No active session - profile will be updated on first login');
          console.warn('[auth] The trigger should have created the profile, but consent timestamps will be set on login');
        }
        // Don't throw - let signup succeed, profile will be updated on login
      } else if (session.user.id !== userId) {
        if (__DEV__) {
          console.error('[auth] ❌ Session user ID mismatch:', {
            sessionUserId: session.user.id,
            expectedUserId: userId,
          });
        }
        throw new Error('Session user ID mismatch');
      } else {
        // We have a valid session - try to update the profile
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            full_name: name,
            terms_accepted_at: now,
            privacy_accepted_at: now,
          })
          .eq('id', userId);

        if (updateError) {
          // If profile doesn't exist (trigger hasn't run yet), that's OK
          // It will be created on login or by the trigger
          if (updateError.code === 'PGRST116' || updateError.message?.includes('No rows')) {
            if (__DEV__) {
              console.log('[auth] ℹ️  Profile not found - trigger will create it on next auth event or on login');
            }
          } else if (updateError.code === '42501') {
            // RLS error - log prominently
            if (__DEV__) {
              console.error('[auth] ❌❌❌ CRITICAL: RLS policy is blocking profile update!');
              console.error('[auth] Error details:', {
                code: updateError.code,
                message: updateError.message,
                userId,
                sessionUserId: session.user.id,
              });
              console.error('[auth] Please verify RLS policies allow users to update their own profile');
            }
            // Don't block signup, but log it as critical
          } else {
            // Other error - log but don't block signup
            if (__DEV__) {
              console.warn('[auth] ⚠️  Failed to update profile:', updateError.message);
            }
          }
        } else {
          if (__DEV__) {
            console.log('[auth] ✅ Profile updated with consent timestamps');
          }
        }
      }
    } catch (profileError) {
      // If update fails, don't block signup - profile will be updated on login
      if (__DEV__) {
        console.warn('[auth] ⚠️  Profile update failed (non-critical):', profileError.message);
        console.warn('[auth] Profile will be created/updated on first login');
        console.warn('[auth] The user will be prompted to accept consent again on next login if consent timestamps are missing');
      }
      // Continue signup even if profile update fails - user can accept consent on next login
    }

    // Fetch profile to get role (might have been set by trigger)
    let profile = null;
    try {
      profile = await getProfile(userId);
      
      // Update last_login timestamp on signup (first login) if not already set
      try {
        await supabase
          .from('profiles')
          .update({ last_login: now })
          .eq('id', userId);
      } catch (updateError) {
        // Non-critical - log but don't fail signup
        if (__DEV__) {
          console.warn('[auth] ⚠️  Failed to update last_login (non-critical):', updateError.message);
        }
      }
    } catch (profileError) {
      console.warn('[auth] ⚠️  Failed to fetch profile after signup (non-critical):', profileError.message);
    }

    // Transform user data to match expected format
    const user = {
      id: userId,
      email,
      name,
      age_group: ageGroup,
      age: ageGroup === '55+' ? 55 : parseInt(ageGroup.split('-')[0]),
      role: profile?.role || 'user', // Include role from profile (set by trigger for admin emails)
      createdAt: now,
      consentedAt: now,
      consentApprover: name,
      consentChannel: 'self',
      pendingConsent: false,
    };

    if (__DEV__) {
      console.log('[auth] ✅ User signed up successfully:', userId);
    }

    return {
      user,
      session: authData.session,
      consentRequired: false,
    };
  } catch (error) {
    if (__DEV__) {
      console.error('[auth] ❌ Signup failed:', error.message);
    }
    throw error;
  }
}

/**
 * Log in a user
 * @param {Object} payload - Login data
 * @param {string} payload.email - Email address
 * @param {string} payload.password - Password
 * @returns {Promise<Object>} User and session data
 */
export async function login({ email, password }) {
  try {
    if (__DEV__) {
      console.log('[auth] Logging in user:', email);
    }

    // Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      // Handle specific error cases
      if (authError.message?.includes('Invalid login credentials') || authError.message?.includes('Invalid')) {
        throw new Error('Invalid credentials');
      }
      
      // Handle email confirmation error
      if (authError.message?.includes('Email not confirmed') || authError.message?.includes('email_not_confirmed')) {
        const error = new Error('Please confirm your email address before logging in. Check your inbox for the confirmation email.');
        error.code = 'email_not_confirmed';
        error.originalError = authError;
        throw error;
      }
      
      throw authError;
    }

    if (!authData.user) {
      throw new Error('Failed to authenticate user');
    }

    const userId = authData.user.id;
    const userMetadata = authData.user.user_metadata || {};

    // Get profile from Supabase
    let profile = null;
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!profileError && profileData) {
        profile = profileData;
        
        // Update last_login timestamp
        try {
          await supabase
            .from('profiles')
            .update({ last_login: new Date().toISOString() })
            .eq('id', userId);
        } catch (updateError) {
          // Non-critical - log but don't fail login
          if (__DEV__) {
            console.warn('[auth] ⚠️  Failed to update last_login (non-critical):', updateError.message);
          }
        }
      } else if (profileError?.code === 'PGRST116') {
        // Profile doesn't exist - recreate it (might have been deleted)
        // This can happen if someone manually deletes a profile but the auth user still exists
        console.log('[auth] Profile not found, recreating...');
        try {
          await upsertProfile({
            id: userId,
            email,
            full_name: userMetadata.full_name || email,
          });
          // Fetch the newly created profile
          const { data: newProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
          profile = newProfile;
          
          // Update last_login for newly created profile
          try {
            await supabase
              .from('profiles')
              .update({ last_login: new Date().toISOString() })
              .eq('id', userId);
          } catch (updateError) {
            if (__DEV__) {
              console.warn('[auth] ⚠️  Failed to update last_login (non-critical):', updateError.message);
            }
          }
        } catch (recreateError) {
          console.warn('[auth] ⚠️  Failed to recreate profile (non-critical):', recreateError.message);
        }
      }
    } catch (profileError) {
      console.warn('[auth] ⚠️  Failed to fetch profile (non-critical):', profileError.message);
    }

    // Get latest consent log
    let consentLog = null;
    let pendingConsent = false;
    try {
      const { data: consentLogs, error: consentError } = await supabase
        .from('consent_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!consentError && consentLogs) {
        consentLog = consentLogs;
        pendingConsent = consentLogs.status === 'pending';
      }
    } catch (consentError) {
      console.warn('[auth] ⚠️  Failed to fetch consent log (non-critical):', consentError.message);
    }

    // Check if consent is pending (for old parental consent flow)
    if (pendingConsent) {
      const error = new Error('Parental consent is still pending');
      error.details = {
        pendingConsent: true,
        user: {
          id: userId,
          email,
          name: userMetadata.full_name || profile?.full_name || email,
        },
      };
      throw error;
    }

    // Check if legal consent (Terms & Conditions and Privacy Policy) is missing
    const missingTermsConsent = !profile?.terms_accepted_at;
    const missingPrivacyConsent = !profile?.privacy_accepted_at;

    if (missingTermsConsent || missingPrivacyConsent) {
      const error = new Error('Legal consent is required');
      error.details = {
        missingLegalConsent: true,
        missingTerms: missingTermsConsent,
        missingPrivacy: missingPrivacyConsent,
        user: {
          id: userId,
          email,
          name: userMetadata.full_name || profile?.full_name || email,
        },
      };
      throw error;
    }

    // Transform user data to match expected format
    const user = {
      id: userId,
      email,
      name: userMetadata.full_name || profile?.full_name || email,
      age_group: userMetadata.age_group || null,
      age: userMetadata.age_group ? (userMetadata.age_group === '55+' ? 55 : parseInt(userMetadata.age_group.split('-')[0])) : null,
      role: profile?.role || 'user', // Include role from profile
      createdAt: authData.user.created_at,
      consentedAt: consentLog?.approved_at || authData.user.created_at,
      consentApprover: consentLog?.approver_name || userMetadata.full_name || email,
      consentChannel: consentLog?.channel || 'self',
      pendingConsent: false,
    };

    if (__DEV__) {
      console.log('[auth] ✅ User logged in successfully:', userId);
    }

    return {
      user,
      session: authData.session,
    };
  } catch (error) {
    if (__DEV__) {
      console.error('[auth] ❌ Login failed:', error.message);
    }
    throw error;
  }
}

/**
 * Submit consent token (for parental consent flow - not used in new flow but kept for compatibility)
 * @param {Object} payload - Consent data
 * @param {string} payload.token - Consent token
 * @param {string} payload.approverName - Name of approver
 * @returns {Promise<Object>} Updated user data
 */
export async function submitConsent({ token, approverName }) {
  try {
    if (__DEV__) {
      console.log('[auth] Submitting consent token:', token);
    }

    // Find consent log by token
    const { data: consentLog, error: findError } = await supabase
      .from('consent_logs')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .single();

    if (findError || !consentLog) {
      throw new Error('Invalid or expired consent token');
    }

    // Update consent log to approved
    const { error: updateError } = await supabase
      .from('consent_logs')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approver_name: approverName || consentLog.contact,
      })
      .eq('id', consentLog.id);

    if (updateError) {
      throw updateError;
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', consentLog.user_id)
      .single();

    if (profileError) {
      throw profileError;
    }

    const user = {
      id: consentLog.user_id,
      email: profile.email,
      name: profile.full_name || profile.email,
      pendingConsent: false,
      consentedAt: new Date().toISOString(),
      consentApprover: approverName || consentLog.contact,
      consentChannel: consentLog.channel || 'email',
    };

    if (__DEV__) {
      console.log('[auth] ✅ Consent approved successfully:', consentLog.user_id);
    }

    return {
      user,
    };
  } catch (error) {
    if (__DEV__) {
      console.error('[auth] ❌ Consent submission failed:', error.message);
    }
    throw error;
  }
}

/**
 * Get current session
 * @returns {Promise<Object|null>} Current session or null
 */
export async function getSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }
    return session;
  } catch (error) {
    console.error('[auth] Failed to get session:', error);
    return null;
  }
}

/**
 * Resend email confirmation
 * @param {string} email - Email address
 * @returns {Promise<void>}
 */
export async function resendConfirmationEmail(email) {
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    
    if (error) {
      throw error;
    }
    
    if (__DEV__) {
      console.log('[auth] ✅ Confirmation email sent to:', email);
    }
  } catch (error) {
    console.error('[auth] Failed to resend confirmation email:', error);
    throw error;
  }
}

/**
 * Change user password
 * @param {Object} payload - Password change data
 * @param {string} payload.currentPassword - Current password for verification
 * @param {string} payload.newPassword - New password
 * @returns {Promise<void>}
 */
export async function changePassword({ currentPassword, newPassword }) {
  try {
    if (__DEV__) {
      console.log('[auth] Changing password for user');
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // Get current email
    const email = user.email;
    if (!email) {
      throw new Error('User email not found');
    }

    // Verify current password by attempting to sign in
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (verifyError) {
      if (verifyError.message?.includes('Invalid login credentials') || verifyError.message?.includes('Invalid')) {
        throw new Error('Current password is incorrect');
      }
      throw verifyError;
    }

    // If verification succeeded, update to new password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      throw updateError;
    }

    if (__DEV__) {
      console.log('[auth] ✅ Password changed successfully');
    }
  } catch (error) {
    if (__DEV__) {
      console.error('[auth] ❌ Password change failed:', error.message);
    }
    throw error;
  }
}

/**
 * Sign out current user
 * @returns {Promise<void>}
 */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
    if (__DEV__) {
      console.log('[auth] ✅ User signed out successfully');
    }
  } catch (error) {
    console.error('[auth] Failed to sign out:', error);
    throw error;
  }
}

