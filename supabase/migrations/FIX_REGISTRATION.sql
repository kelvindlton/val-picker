-- Update event dates based on TODAY (February 5, 2026)
-- Copy and paste this ENTIRE script into Supabase SQL Editor and click RUN

-- Step 1: Update the event dates to TODAY
UPDATE events 
SET 
    registration_deadline = '2026-02-05 23:59:59+00',  -- End of today
    draw_date = '2026-02-05 00:00:00+00',              -- Today (for testing)
    event_date = '2026-02-05 00:00:00+00',             -- Today (for testing)
    status = 'REGISTRATION_OPEN'
WHERE id = 'valentine-2026';

-- Step 2: Verify the update worked
SELECT 
    id, 
    name, 
    registration_deadline, 
    draw_date, 
    event_date, 
    status,
    NOW() as current_time,
    CASE 
        WHEN NOW() < registration_deadline THEN 'REGISTRATION OPEN ✅'
        ELSE 'REGISTRATION CLOSED ❌'
    END as registration_status,
    EXTRACT(HOUR FROM (registration_deadline - NOW())) || ' hours until deadline' as time_remaining
FROM events 
WHERE id = 'valentine-2026';

-- If you see "REGISTRATION OPEN ✅" in the results, you're good to go!
