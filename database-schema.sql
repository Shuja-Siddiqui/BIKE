-- =================== Collaboration Database Schema ===================
-- SQL schema for Y.js collaboration features in Supabase

-- Table for storing collaboration sessions
CREATE TABLE IF NOT EXISTS collaborations (
    id TEXT PRIMARY KEY,
    host_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    participants JSONB DEFAULT '[]'::JSONB,
    settings JSONB DEFAULT '{
        "allowGuests": true,
        "maxParticipants": 10,
        "publicAccess": true
    }'::JSONB,
    title TEXT,
    description TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for storing collaboration activities (messages, artifacts, etc.)
CREATE TABLE IF NOT EXISTS collaboration_activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    collaboration_id TEXT REFERENCES collaborations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id TEXT, -- For guest users
    activity_type TEXT NOT NULL CHECK (activity_type IN ('message', 'artifact', 'cursor', 'join', 'leave', 'edit')),
    activity_data JSONB NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Table for storing Y.js document states (optional, for persistence)
CREATE TABLE IF NOT EXISTS collaboration_documents (
    collaboration_id TEXT PRIMARY KEY REFERENCES collaborations(id) ON DELETE CASCADE,
    document_state BYTEA, -- Y.js encoded document state
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER DEFAULT 1
);

-- Table for tracking active participants in real-time
CREATE TABLE IF NOT EXISTS collaboration_participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    collaboration_id TEXT REFERENCES collaborations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT, -- For guest users
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    cursor_position JSONB,
    user_info JSONB NOT NULL, -- Name, color, type (user/guest)
    UNIQUE(collaboration_id, user_id),
    UNIQUE(collaboration_id, session_id)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_collaborations_host_user ON collaborations(host_user_id);
CREATE INDEX IF NOT EXISTS idx_collaborations_active ON collaborations(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_collaborations_created_at ON collaborations(created_at);

CREATE INDEX IF NOT EXISTS idx_activities_collaboration ON collaboration_activities(collaboration_id);
CREATE INDEX IF NOT EXISTS idx_activities_user ON collaboration_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_session ON collaboration_activities(session_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON collaboration_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON collaboration_activities(timestamp);

CREATE INDEX IF NOT EXISTS idx_participants_collaboration ON collaboration_participants(collaboration_id);
CREATE INDEX IF NOT EXISTS idx_participants_active ON collaboration_participants(is_active) WHERE is_active = TRUE;

-- RLS (Row Level Security) policies
ALTER TABLE collaborations ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_participants ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read any active collaboration
CREATE POLICY "Anyone can read active collaborations"
    ON collaborations FOR SELECT
    USING (is_active = TRUE);

-- Policy: Only authenticated users can create collaborations
CREATE POLICY "Authenticated users can create collaborations"
    ON collaborations FOR INSERT
    WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = host_user_id);

-- Policy: Host can update their own collaborations
CREATE POLICY "Host can update own collaborations"
    ON collaborations FOR UPDATE
    USING (auth.uid() = host_user_id);

-- Policy: Host can delete their own collaborations
CREATE POLICY "Host can delete own collaborations"
    ON collaborations FOR DELETE
    USING (auth.uid() = host_user_id);

-- Policy: Users can read activities from collaborations they participate in
CREATE POLICY "Participants can read collaboration activities"
    ON collaboration_activities FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM collaborations c 
            WHERE c.id = collaboration_id 
            AND c.is_active = TRUE
        )
    );

-- Policy: Authenticated users can create activities in active collaborations
CREATE POLICY "Authenticated users can create activities"
    ON collaboration_activities FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated' AND
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM collaborations c 
            WHERE c.id = collaboration_id 
            AND c.is_active = TRUE
        )
    );

-- Policy: Allow guest users to create activities (with session_id)
CREATE POLICY "Guest users can create activities"
    ON collaboration_activities FOR INSERT
    WITH CHECK (
        user_id IS NULL AND
        session_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM collaborations c 
            WHERE c.id = collaboration_id 
            AND c.is_active = TRUE 
            AND (c.settings->>'allowGuests')::boolean = TRUE
        )
    );

-- Policy: Participants can read document states
CREATE POLICY "Participants can read document states"
    ON collaboration_documents FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM collaborations c 
            WHERE c.id = collaboration_id 
            AND c.is_active = TRUE
        )
    );

-- Policy: System can manage document states
CREATE POLICY "System can manage document states"
    ON collaboration_documents FOR ALL
    USING (TRUE);

-- Policy: Participants can manage their own participant record
CREATE POLICY "Users can manage own participation"
    ON collaboration_participants FOR ALL
    USING (auth.uid() = user_id OR session_id IS NOT NULL);

-- Functions for collaboration management
CREATE OR REPLACE FUNCTION update_collaboration_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE collaborations 
    SET last_activity = NOW(), updated_at = NOW()
    WHERE id = NEW.collaboration_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_activity when new activities are added
CREATE TRIGGER trigger_update_collaboration_activity
    AFTER INSERT ON collaboration_activities
    FOR EACH ROW
    EXECUTE FUNCTION update_collaboration_activity();

-- Function to clean up inactive collaborations
CREATE OR REPLACE FUNCTION cleanup_inactive_collaborations()
RETURNS INTEGER AS $$
DECLARE
    cleanup_count INTEGER;
BEGIN
    -- Mark collaborations as inactive if no activity for 24 hours
    UPDATE collaborations 
    SET is_active = FALSE, updated_at = NOW()
    WHERE is_active = TRUE 
    AND last_activity < NOW() - INTERVAL '24 hours';
    
    GET DIAGNOSTICS cleanup_count = ROW_COUNT;
    
    -- Clean up old inactive collaborations (older than 7 days)
    DELETE FROM collaborations 
    WHERE is_active = FALSE 
    AND updated_at < NOW() - INTERVAL '7 days';
    
    RETURN cleanup_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get collaboration statistics
CREATE OR REPLACE FUNCTION get_collaboration_stats(collab_id TEXT)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_participants', (
            SELECT COUNT(DISTINCT COALESCE(user_id::TEXT, session_id))
            FROM collaboration_activities 
            WHERE collaboration_id = collab_id
        ),
        'total_activities', (
            SELECT COUNT(*) 
            FROM collaboration_activities 
            WHERE collaboration_id = collab_id
        ),
        'active_participants', (
            SELECT COUNT(*) 
            FROM collaboration_participants 
            WHERE collaboration_id = collab_id AND is_active = TRUE
        ),
        'last_activity', (
            SELECT MAX(timestamp) 
            FROM collaboration_activities 
            WHERE collaboration_id = collab_id
        ),
        'activity_by_type', (
            SELECT jsonb_object_agg(activity_type, count)
            FROM (
                SELECT activity_type, COUNT(*) as count
                FROM collaboration_activities 
                WHERE collaboration_id = collab_id
                GROUP BY activity_type
            ) t
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up inactive collaborations (if pg_cron is available)
-- SELECT cron.schedule('cleanup-collaborations', '0 2 * * *', 'SELECT cleanup_inactive_collaborations();');