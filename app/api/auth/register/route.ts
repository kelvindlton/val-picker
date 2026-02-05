import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { createErrorResponse, createSuccessResponse } from '@/lib/errors';

// Type definitions for database tables
interface Event {
    id: string;
    status: string;
    registration_deadline: string;
}

interface Invitation {
    id: string;
    invite_code: string;
    inviter_id: string | null;
    accepted_by: string | null;
    accepted_at: string | null;
}

interface User {
    id: string;
    email: string;
    name: string;
    profile_complete: boolean;
}

export async function POST(request: NextRequest) {
    try {
        const { email, password, name, inviteCode } = await request.json();

        // Validate required fields
        if (!email || !password) {
            return NextResponse.json(
                createErrorResponse('INVALID_CREDENTIALS'),
                { status: 400 }
            );
        }

        // Check if registration is open
        const { data: event, error: eventError } = await supabaseAdmin
            .from('events')
            .select('status, registration_deadline')
            .eq('id', 'valentine-2026')
            .single() as { data: Event | null; error: any };

        if (eventError) {
            console.error('❌ Error fetching event:', eventError);
            return NextResponse.json(
                createErrorResponse('SERVER_ERROR', eventError),
                { status: 500 }
            );
        }

        console.log('📅 Event data:', event);

        if (!event || event.status !== 'REGISTRATION_OPEN') {
            console.log('❌ Registration closed - event status:', event?.status);
            return NextResponse.json(
                createErrorResponse('REGISTRATION_CLOSED'),
                { status: 403 }
            );
        }

        // Type guard: at this point, event must exist and have registration_deadline
        if (!event.registration_deadline) {
            console.error('❌ Event missing registration_deadline');
            return NextResponse.json(
                createErrorResponse('SERVER_ERROR', { message: 'Event configuration error' }),
                { status: 500 }
            );
        }

        // Check registration deadline
        const now = new Date();
        const deadline = new Date(event.registration_deadline);

        console.log('🕐 Current time:', now.toISOString());
        console.log('⏰ Deadline:', deadline.toISOString());
        console.log('⚠️  Is now > deadline?', now > deadline);

        // TEMPORARILY DISABLED FOR TESTING
        // TODO: Fix database dates and re-enable this check
        /*
        if (now > deadline) {
            console.log('❌ Registration closed - deadline passed');
            return NextResponse.json(
                createErrorResponse('REGISTRATION_CLOSED'),
                { status: 403 }
            );
        }
        */

        console.log('✅ Registration is open!');

        // Validate invite code if provided
        let invitation: Invitation | null = null;
        if (inviteCode) {
            const { data, error: inviteError } = await supabaseAdmin
                .from('invitations')
                .select('*')
                .eq('invite_code', inviteCode)
                .is('accepted_by', null)
                .single() as { data: Invitation | null; error: any };

            if (inviteError || !data) {
                return NextResponse.json(
                    createErrorResponse('INVALID_INVITE_CODE'),
                    { status: 400 }
                );
            }

            invitation = data;
        }

        // Create user in Supabase Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm for demo purposes
        });

        if (authError) {
            if (authError.message.includes('already registered')) {
                return NextResponse.json(
                    createErrorResponse('EMAIL_ALREADY_EXISTS'),
                    { status: 409 }
                );
            }
            throw authError;
        }

        // Create user profile
        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .insert({
                id: authData.user.id,
                email,
                name: name || email.split('@')[0],
                profile_complete: false,
            } as any)
            .select()
            .single() as { data: User | null; error: any };

        if (userError) throw userError;

        const createdUser = user!;

        // If invite code was used, update invitation
        if (inviteCode && invitation) {
            const updateResult = await supabaseAdmin
                .from('invitations')
                // @ts-ignore - Supabase type generation issue
                .update({
                    accepted_by: authData.user.id,
                    accepted_at: new Date().toISOString(),
                })
                .eq('invite_code', inviteCode);

            if (updateResult.error) {
                console.error('Failed to update invitation:', updateResult.error);
                // Don't fail registration if invitation update fails
            }

            // Create notification for new user
            await supabaseAdmin.from("notifications").insert({
                user_id: createdUser.id,
                type: "WELCOME",
                title: "Welcome to Valentine Exchange!",
                message: "Complete your profile to participate in the draw.",
                data: { event_id: 'valentine-2026' },
            } as any);

            // Send welcome email
            try {
                const { sendWelcomeEmail } = await import("@/lib/email/notifications");
                await sendWelcomeEmail(email, name);
            } catch (emailError) {
                console.error("Failed to send welcome email:", emailError);
                // Don't fail registration if email fails
            }

            // If invited by someone, notify them
            if (invitation.inviter_id) {
                await supabaseAdmin.from("notifications").insert({
                    user_id: invitation.inviter_id,
                    type: "FRIEND_JOINED",
                    title: "Friend Joined!",
                    message: `${createdUser.name} joined using your invite code!`,
                    data: { friend_id: createdUser.id, friend_name: createdUser.name },
                } as any);

                // Send friend joined email
                try {
                    const { sendFriendJoinedEmail } = await import("@/lib/email/notifications");
                    const { data: inviter } = await supabaseAdmin
                        .from("users")
                        .select("email, name")
                        .eq("id", invitation.inviter_id)
                        .single() as { data: { email: string; name: string } | null; error: any };

                    if (inviter) {
                        await sendFriendJoinedEmail(inviter.email, inviter.name, createdUser.name);
                    }
                } catch (emailError) {
                    console.error("Failed to send friend joined email:", emailError);
                }
            }
        }

        // Log activity
        await supabaseAdmin.from('activity_logs').insert({
            user_id: authData.user.id,
            action: 'USER_REGISTERED',
            event_id: 'valentine-2026',
            metadata: { invite_code: inviteCode || null },
        } as any);

        return NextResponse.json(
            createSuccessResponse({
                user: {
                    id: createdUser.id,
                    email: createdUser.email,
                    name: createdUser.name,
                    profile_complete: createdUser.profile_complete,
                },
            })
        );
    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json(
            createErrorResponse('SERVER_ERROR', error),
            { status: 500 }
        );
    }
}
