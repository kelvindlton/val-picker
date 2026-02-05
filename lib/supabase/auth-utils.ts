import { supabase } from './client';

/**
 * Clear invalid or expired auth sessions
 * This helps prevent "Invalid Refresh Token" errors
 */
export async function clearInvalidSession() {
    try {
        // Try to get the current session
        const { data: { session }, error } = await supabase.auth.getSession();

        // If there's an error or no session, clear everything
        if (error || !session) {
            await supabase.auth.signOut();

            // Clear all auth-related items from localStorage
            if (typeof window !== 'undefined') {
                const keysToRemove: string[] = [];
                for (let i = 0; i < window.localStorage.length; i++) {
                    const key = window.localStorage.key(i);
                    if (key && key.startsWith('sb-')) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(key => window.localStorage.removeItem(key));
            }
        }
    } catch (error) {
        // Silently handle errors - we're just cleaning up
        console.log('Session cleanup completed');
    }
}

/**
 * Initialize auth and handle any invalid sessions
 */
export async function initializeAuth() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();

        // If there's a refresh token error, clear the session
        if (error && error.message.includes('refresh_token_not_found')) {
            await clearInvalidSession();
            return null;
        }

        return session;
    } catch (error) {
        await clearInvalidSession();
        return null;
    }
}
