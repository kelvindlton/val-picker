"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { initializeAuth } from "@/lib/supabase/auth-utils";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export interface WishlistItem {
    id: string;
    name: string;
    description?: string;
    link?: string;
    icon?: string;
}

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    bio?: string;
    work?: string;
    hobbies?: string;
    avatar_url?: string;
    profile_complete: boolean;
    wishlist?: WishlistItem[];
}

interface UserContextType {
    user: UserProfile | null;
    supabaseUser: SupabaseUser | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    register: (email: string, password: string, name?: string, inviteCode?: string) => Promise<void>;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch user profile from database
    const fetchUserProfile = async (userId: string) => {
        try {
            const { data: profile, error } = await supabase
                .from('users')
                .select(`
          *,
          wishlist_items (
            id,
            name,
            description,
            link,
            icon,
            display_order
          )
        `)
                .eq('id', userId)
                .maybeSingle(); // Use maybeSingle() instead of single() to handle 0 results

            // If error or no profile found, sign out the orphaned auth session
            if (error) {
                console.error('Error fetching user profile:', error);
                // If user doesn't exist in database, sign them out
                if (error.code === 'PGRST116' || !profile) {
                    console.log('User profile not found, signing out...');
                    await supabase.auth.signOut();
                    setUser(null);
                    setSupabaseUser(null);
                    return;
                }
                throw error;
            }

            if (!profile) {
                // Profile doesn't exist, sign out the orphaned session
                console.log('User profile not found in database, signing out...');
                await supabase.auth.signOut();
                setUser(null);
                setSupabaseUser(null);
                return;
            }

            // Profile exists, set user state
            setUser({
                id: profile.id,
                email: profile.email,
                name: profile.name || '',
                bio: profile.bio || '',
                work: profile.work || '',
                hobbies: profile.hobbies || '',
                avatar_url: profile.avatar_url || '',
                profile_complete: profile.profile_complete,
                wishlist: profile.wishlist_items || [],
            });
        } catch (error) {
            console.error('Error fetching user profile:', error);
            // On any error, sign out to be safe
            await supabase.auth.signOut();
            setUser(null);
            setSupabaseUser(null);
        }
    };

    // Initialize auth state
    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSupabaseUser(session?.user ?? null);
            if (session?.user) {
                fetchUserProfile(session.user.id);
            }
            setIsLoading(false);
        });

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setSupabaseUser(session?.user ?? null);
            if (session?.user) {
                await fetchUserProfile(session.user.id);
            } else {
                setUser(null);
            }
            setIsLoading(false);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const register = async (
        email: string,
        password: string,
        name?: string,
        inviteCode?: string
    ) => {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name, inviteCode }),
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error.message);
        }

        // Sign in after registration
        await login(email, password);
    };

    const login = async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;

        if (data.user) {
            await fetchUserProfile(data.user.id);
        }
    };

    const logout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        setUser(null);
        setSupabaseUser(null);
    };

    const updateProfile = async (data: Partial<UserProfile>) => {
        if (!supabaseUser) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('users')
            .update({
                name: data.name,
                bio: data.bio,
                work: data.work,
                hobbies: data.hobbies,
                avatar_url: data.avatar_url,
                profile_complete: data.profile_complete,
            })
            .eq('id', supabaseUser.id);

        if (error) throw error;

        // Refresh user data
        await fetchUserProfile(supabaseUser.id);
    };

    const refreshUser = async () => {
        if (supabaseUser) {
            await fetchUserProfile(supabaseUser.id);
        }
    };

    return (
        <UserContext.Provider
            value={{
                user,
                supabaseUser,
                isAuthenticated: !!supabaseUser,
                isLoading,
                register,
                login,
                logout,
                updateProfile,
                refreshUser,
            }}
        >
            {children}
        </UserContext.Provider>
    );
}

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) throw new Error("useUser must be used within UserProvider");
    return context;
};
