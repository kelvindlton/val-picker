/**
 * Suppress Supabase auth refresh token errors in console
 * These errors are harmless and occur when expired sessions are cleaned up
 */
if (typeof window !== 'undefined') {
    const originalError = console.error;
    console.error = (...args) => {
        // Suppress "Invalid Refresh Token" errors from Supabase
        const errorMessage = args[0]?.toString() || '';
        if (
            errorMessage.includes('Invalid Refresh Token') ||
            errorMessage.includes('refresh_token_not_found') ||
            errorMessage.includes('AuthApiError')
        ) {
            // Silently ignore these errors - they're handled by our auth flow
            return;
        }
        // Log all other errors normally
        originalError.apply(console, args);
    };
}

export { };
