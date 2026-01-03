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
    // Sanitize and validate email
    const sanitizedEmail = email ? email.trim().toLowerCase() : '';
    if (!sanitizedEmail) {
      throw new Error('Email is required.');
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitizedEmail)) {
      throw new Error('Please enter a valid email address.');
    }

    // Validate password
    if (!password || password.trim().length === 0) {
      throw new Error('Password is required.');
    }

    // Validate name
    const sanitizedName = name ? name.trim() : '';
    if (!sanitizedName) {
      throw new Error('Name is required.');
    }

    if (__DEV__) {
      console.log('[auth] Signing up user:', { email: sanitizedEmail, name: sanitizedName, ageGroup });
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
    // Include consent acceptance in user metadata so the trigger can set consent timestamps
    // Set emailRedirectTo to use deep link scheme so email verification opens the app
    const now = new Date().toISOString();
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: sanitizedEmail,
      password,
      options: {
        emailRedirectTo: 'nailsbyabri://email-verified',
        data: {
          full_name: sanitizedName,
          age_group: ageGroup,
          consent_accepted: consentAccepted,
          consent_accepted_at: consentAccepted ? now : null,
        },
      },
    });

    if (authError) {
      // Log full error details for debugging
      if (__DEV__) {
        console.error('[auth] ❌ Supabase signup error:', {
          message: authError.message,
          code: authError.code,
          status: authError.status,
          details: authError.details,
          hint: authError.hint,
          fullError: authError,
        });
      }
      
      if (authError.message?.includes('already registered') || authError.message?.includes('already exists')) {
        throw new Error('Account already exists for this email. Try logging in or use "Forgot password".');
      }
      
      // Handle database/trigger errors
      // Note: "Database error saving new user" typically means the trigger failed
      // The user might still be created in auth.users, but profile creation failed
      if (authError.message?.includes('Database error') || 
          authError.message?.includes('database') ||
          authError.message?.includes('trigger') ||
          authError.code === '23505' || // Unique violation
          authError.code === '23503' || // Foreign key violation
          authError.code === 'PGRST301' || // PostgREST error
          authError.code === '42501') { // RLS policy violation
        if (__DEV__) {
          console.error('[auth] 💡 Database error likely means trigger failed. Check:');
          console.error('[auth] 💡   1. Run docs/supabase-verify-and-fix-profile-trigger.sql');
          console.error('[auth] 💡   2. Verify trigger exists: SELECT * FROM pg_trigger WHERE tgname = \'on_auth_user_created\';');
          console.error('[auth] 💡   3. Check Supabase logs for trigger errors');
        }
        const userMessage = authError.message?.includes('Database error')
          ? 'Unable to create account due to a database issue. The trigger that creates your profile may not be configured correctly. Please contact support.'
          : `Unable to create account: ${authError.message || 'Database error'}`;
        throw new Error(userMessage);
      }
      
      // Re-throw other errors with a user-friendly message
      const userMessage = authError.message || 'Unable to create account. Please try again.';
      throw new Error(userMessage);
    }

    if (!authData.user) {
      throw new Error('Failed to create user account');
    }

    const userId = authData.user.id;
    // Note: 'now' was already defined above for consent timestamps in user metadata

    // IMPORTANT: Do NOT set session after signup - user must verify email first
    // Supabase will send an email confirmation link automatically
    // The user will not be logged in until they verify their email
    if (__DEV__) {
      if (authData.session) {
        console.log('[auth] ℹ️  Session returned from signup (will be cleared - email verification required)');
      } else {
        console.log('[auth] ℹ️  No session in signUp response - email confirmation required');
      }
      console.log('[auth] ✅ Account created successfully. Email verification required before login.');
    }

    // Clear any existing session to ensure user is not logged in
    await supabase.auth.signOut();

    // The trigger should create the profile automatically when auth.users is created
    // Wait a moment for the trigger to execute
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify profile was created by trigger (optional check for debugging)
    if (__DEV__) {
      try {
        const { data: profileCheck, error: profileError } = await supabase
          .from('profiles')
          .select('id, email, terms_accepted_at, privacy_accepted_at')
          .eq('id', userId)
          .single();
        
        if (profileError || !profileCheck) {
          console.warn('[auth] ⚠️  Profile not found after signup. Trigger may not have executed:', profileError?.message || 'Profile not found');
          console.warn('[auth] 💡 Make sure the trigger is set up: Run docs/supabase-fix-profile-trigger-simple.sql');
        } else {
          console.log('[auth] ✅ Profile created by trigger:', {
            id: profileCheck.id,
            email: profileCheck.email,
            hasTermsConsent: !!profileCheck.terms_accepted_at,
            hasPrivacyConsent: !!profileCheck.privacy_accepted_at,
          });
        }
      } catch (checkError) {
        // Silently fail - profile check is optional
        if (__DEV__) {
          console.warn('[auth] ⚠️  Could not verify profile creation:', checkError.message);
        }
      }
    }

    // Return user data for display purposes only (user is NOT logged in)
    // Email verification is required before login
    // Profile should be created by database trigger with consent timestamps
    const user = {
      id: userId,
      email: sanitizedEmail,
      name: sanitizedName,
      age_group: ageGroup,
      age: ageGroup === '55+' ? 55 : parseInt(ageGroup.split('-')[0]),
      role: 'user',
      createdAt: now,
    };

    if (__DEV__) {
      console.log('[auth] ✅ User account created successfully:', userId);
      console.log('[auth] ℹ️  Profile should be created by database trigger with consent timestamps');
      console.log('[auth] ℹ️  User must verify email before logging in');
    }

    return {
      user,
      emailConfirmationRequired: true,
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
      if (authError.message?.includes('Email not confirmed') || 
          authError.message?.includes('email_not_confirmed') ||
          authError.message?.includes('confirm') ||
          authError.code === 'email_not_confirmed') {
        const error = new Error('Please verify your email address before logging in. Check your inbox for a verification email from Supabase, then try logging in again.');
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
        
        // Update last_login timestamp and auth method
        try {
          // Update auth method to track password usage
          try {
            await supabase.rpc('update_auth_method', {
              p_user_id: userId,
              p_method: 'password',
            });
          } catch (rpcError) {
            // Non-critical - function might not exist yet (backward compatibility)
            if (__DEV__) {
              console.warn('[auth] ⚠️  Failed to update auth method (non-critical):', rpcError.message);
            }
          }
          
          // Also update last_login directly (update_auth_method does this too, but do it here as fallback)
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
            // Update auth method to track password usage
            try {
              await supabase.rpc('update_auth_method', {
                p_user_id: userId,
                p_method: 'password',
              });
            } catch (rpcError) {
              // Non-critical - function might not exist yet (backward compatibility)
              if (__DEV__) {
                console.warn('[auth] ⚠️  Failed to update auth method (non-critical):', rpcError.message);
              }
            }
            
            // Also update last_login directly
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

/**
 * Send OTP (magic link) to email
 * @param {string} email - Email address
 * @returns {Promise<void>}
 */
export async function sendEmailOTP(email) {
  try {
    if (__DEV__) {
      console.log('[auth] Sending email OTP to:', email);
    }

    const sanitizedEmail = email.trim().toLowerCase();
    
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitizedEmail)) {
      throw new Error('Please enter a valid email address.');
    }

    // Send email OTP code via Supabase Auth
    // Note: emailRedirectTo is removed to send a code instead of a magic link
    const { error } = await supabase.auth.signInWithOtp({
      email: sanitizedEmail,
      options: {
        shouldCreateUser: true, // Auto-create account if doesn't exist
      },
    });

    if (error) {
      if (__DEV__) {
        console.error('[auth] ❌ Failed to send email OTP:', error);
        console.error('[auth] Error details:', {
          message: error.message,
          status: error.status,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
      }
      // Provide more specific error message
      const errorMessage = error.message || 'Failed to send verification email';
      throw new Error(errorMessage);
    }

    if (__DEV__) {
      console.log('[auth] ✅ Email OTP sent successfully');
    }
  } catch (error) {
    if (__DEV__) {
      console.error('[auth] ❌ Email OTP failed:', error.message);
    }
    throw error;
  }
}

/**
 * Send OTP via SMS to phone number
 * @param {string} phone - Phone number (E.164 format: +1234567890)
 * @returns {Promise<void>}
 */
export async function sendSMSOTP(phone) {
  try {
    if (__DEV__) {
      console.log('[auth] Sending SMS OTP to:', phone);
    }

    const sanitizedPhone = phone.trim();
    
    // Basic phone format validation (E.164 format: starts with +, followed by digits)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(sanitizedPhone)) {
      throw new Error('Please enter a valid phone number in international format (e.g., +1234567890).');
    }

    // Send SMS OTP via Supabase Auth
    const { error } = await supabase.auth.signInWithOtp({
      phone: sanitizedPhone,
      options: {
        shouldCreateUser: true, // Auto-create account if doesn't exist
      },
    });

    if (error) {
      if (__DEV__) {
        console.error('[auth] ❌ Failed to send SMS OTP:', error);
      }
      throw error;
    }

    if (__DEV__) {
      console.log('[auth] ✅ SMS OTP sent successfully');
    }
  } catch (error) {
    if (__DEV__) {
      console.error('[auth] ❌ SMS OTP failed:', error.message);
    }
    throw error;
  }
}

/**
 * Verify OTP and sign in user
 * @param {Object} payload - OTP verification data
 * @param {string} payload.email - Email address (for email OTP)
 * @param {string} payload.phone - Phone number (for SMS OTP)
 * @param {string} payload.token - OTP token/code
 * @param {string} payload.type - 'email' or 'sms'
 * @returns {Promise<Object>} User and session data
 */
export async function verifyOTP({ email, phone, token, type = 'email' }) {
  try {
    if (__DEV__) {
      console.log('[auth] Verifying OTP:', { type, hasEmail: !!email, hasPhone: !!phone });
    }

    // Verify OTP via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.verifyOtp({
      email: email?.trim().toLowerCase(),
      phone: phone?.trim(),
      token,
      type: type === 'email' ? 'email' : 'sms',
    });

    if (authError) {
      if (__DEV__) {
        console.error('[auth] ❌ OTP verification failed:', authError);
      }
      
      if (authError.message?.includes('Invalid') || authError.message?.includes('expired')) {
        throw new Error('Invalid or expired code. Please request a new one.');
      }
      throw authError;
    }

    if (!authData.user) {
      throw new Error('Failed to authenticate user');
    }

    const userId = authData.user.id;
    const userMetadata = authData.user.user_metadata || {};

    // Get or create profile
    let profile = null;
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!profileError && profileData) {
        profile = profileData;
        
        // Update auth method and last login
        const hasCompletedSignup = profile.age_group && profile.terms_accepted_at && profile.privacy_accepted_at;
        if (hasCompletedSignup) {
          const authMethod = type === 'email' ? 'email_code' : 'sms_code';
          try {
            await supabase.rpc('update_auth_method', {
              p_user_id: userId,
              p_method: authMethod,
            });
          } catch (rpcError) {
            // Non-critical - log but don't fail
            if (__DEV__) {
              console.warn('[auth] ⚠️  Failed to update auth method (non-critical):', rpcError.message);
            }
          }
        }
        
        // Always update last_login directly as a fallback (update_auth_method also does this, but this ensures it works)
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

        // Update phone if provided and not already set
        if (phone && !profile.phone) {
          await supabase
            .from('profiles')
            .update({ phone: phone.trim() })
            .eq('id', userId);
          profile.phone = phone.trim();
        }
      } else if (profileError?.code === 'PGRST116') {
        // Profile doesn't exist - this shouldn't happen with the trigger, but handle it
        if (__DEV__) {
          console.warn('[auth] ⚠️  Profile not found, creating...');
        }
        // Profile should be created by trigger, wait a moment
        await new Promise(resolve => setTimeout(resolve, 1000));
        const { data: newProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        profile = newProfile;
      }
    } catch (profileError) {
      console.warn('[auth] ⚠️  Failed to fetch profile (non-critical):', profileError.message);
    }

    // Determine if user needs to complete signup (missing age_group or consent)
    // This is more reliable than checking created_at === updated_at
    const needsSignupCompletion = !profile?.age_group || !profile?.terms_accepted_at || !profile?.privacy_accepted_at;
    
    // If user needs signup completion, don't check for consent errors - they'll complete it via AgeVerification
    // Only check consent for users who should have already completed signup
    if (!needsSignupCompletion) {
      // User has completed signup, so they should have consent - this shouldn't happen, but handle gracefully
      const missingTermsConsent = !profile?.terms_accepted_at;
      const missingPrivacyConsent = !profile?.privacy_accepted_at;
      
      if (missingTermsConsent || missingPrivacyConsent) {
        // This is unexpected - treat as needing signup completion
        if (__DEV__) {
          console.warn('[auth] ⚠️  Profile exists but missing consent - routing to signup completion');
        }
      }
    }

    // Transform user data
    const user = {
      id: userId,
      email: authData.user.email || null,
      phone: phone || authData.user.phone || profile?.phone || null,
      name: userMetadata.full_name || profile?.full_name || authData.user.email || phone,
      age_group: userMetadata.age_group || profile?.age_group || null,
      age: userMetadata.age_group 
        ? (userMetadata.age_group === '55+' ? 55 : parseInt(userMetadata.age_group.split('-')[0]))
        : (profile?.age_group === '55+' ? 55 : profile?.age_group ? parseInt(profile.age_group.split('-')[0]) : null),
      role: profile?.role || 'user',
      createdAt: authData.user.created_at,
      needsAgeVerification: needsSignupCompletion, // User needs to complete signup (age + consent)
      needsName: !profile?.full_name || (profile.full_name === authData.user.email) || (profile.full_name === phone),
    };

    if (__DEV__) {
      console.log('[auth] ✅ OTP verified successfully:', userId);
      console.log('[auth] Needs signup completion:', needsSignupCompletion);
    }

    return {
      user,
      session: authData.session,
      needsAgeVerification: needsSignupCompletion, // Route to AgeVerification (which includes consent)
      needsName: !profile?.full_name || (profile.full_name === authData.user.email) || (profile.full_name === phone),
    };
  } catch (error) {
    if (__DEV__) {
      console.error('[auth] ❌ OTP verification failed:', error.message);
    }
    throw error;
  }
}

/**
 * Complete passwordless signup with age verification and optional name
 * @param {Object} payload - Signup completion data
 * @param {string} payload.userId - User ID
 * @param {string} payload.ageGroup - Age group (13-17, 18-24, etc.)
 * @param {string} payload.name - Optional name
 * @param {boolean} payload.consentAccepted - Whether user accepted Terms & Privacy
 * @returns {Promise<Object>} Updated user data
 */
export async function completePasswordlessSignup({ userId, ageGroup, name, consentAccepted = false }) {
  try {
    if (__DEV__) {
      console.log('[auth] Completing passwordless signup:', { userId, ageGroup, hasName: !!name });
    }

    // Validate age group
    const validAgeGroups = ['13-17', '18-24', '25-34', '35-44', '45-54', '55+'];
    if (!validAgeGroups.includes(ageGroup)) {
      throw new Error('Invalid age group. You must be 13 years or older.');
    }

    // Check if under 13
    const ageMin = ageGroup === '55+' ? 55 : parseInt(ageGroup.split('-')[0]);
    if (ageMin < 13) {
      throw new Error('You must be 13 years or older to create an account.');
    }

    // Validate consent
    if (!consentAccepted) {
      throw new Error('You must accept the Terms & Conditions and Privacy Policy to create an account.');
    }

    // Update profile with age group, name, and consent
    const now = new Date().toISOString();
    const updateData = {
      age_group: ageGroup,
      terms_accepted_at: now,
      privacy_accepted_at: now,
      updated_at: now,
    };

    if (name && name.trim()) {
      updateData.full_name = name.trim();
    }

    const { data: profile, error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Get updated user data
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      throw userError;
    }

    const userData = {
      id: userId,
      email: user.email || null,
      phone: user.phone || profile?.phone || null,
      name: profile.full_name || user.email || user.phone,
      age_group: ageGroup,
      age: ageMin,
      role: profile.role || 'user',
      createdAt: user.created_at,
    };

    if (__DEV__) {
      console.log('[auth] ✅ Passwordless signup completed:', userId);
    }

    return {
      user: userData,
    };
  } catch (error) {
    if (__DEV__) {
      console.error('[auth] ❌ Complete passwordless signup failed:', error.message);
    }
    throw error;
  }
}

/**
 * Update user name in profile
 * @param {string} userId - User ID
 * @param {string} name - Name to set (null to skip)
 * @returns {Promise<void>}
 */
export async function updateUserName(userId, name) {
  try {
    if (__DEV__) {
      console.log('[auth] Updating user name:', userId);
    }

    const sanitizedName = name ? name.trim() : null;

    const { error } = await supabase
      .from('profiles')
      .update({ 
        full_name: sanitizedName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      throw error;
    }

    if (__DEV__) {
      console.log('[auth] ✅ User name updated successfully');
    }
  } catch (error) {
    if (__DEV__) {
      console.error('[auth] ❌ Failed to update user name:', error.message);
    }
    throw error;
  }
}

