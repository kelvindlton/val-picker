-- Create the valentine-2026 event if it doesn't exist
-- Run this in your Supabase SQL Editor

INSERT INTO events (id, name, registration_deadline, draw_date, event_date, status)
VALUES (
    'valentine-2026',
    'Valentine Exchange 2026',
    '2026-02-05 23:59:59+00',  -- End of today
    '2026-02-06 00:00:00+00',  -- Tomorrow
    '2026-02-14 00:00:00+00',  -- Valentine's Day
    'REGISTRATION_OPEN'
)
ON CONFLICT (id) DO UPDATE SET
    registration_deadline = EXCLUDED.registration_deadline,
    draw_date = EXCLUDED.draw_date,
    event_date = EXCLUDED.event_date,
    status = EXCLUDED.status;

-- Verify the event was created
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
    END as registration_status
FROM events 
WHERE id = 'valentine-2026';
