-- =====================================================
-- Add custom tags for watchlist items
-- =====================================================

-- Table for user-defined tags
CREATE TABLE watchlist_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(7) DEFAULT '#6b7280', -- Hex color
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Enable RLS
ALTER TABLE watchlist_tags ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own tags"
    ON watchlist_tags FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tags"
    ON watchlist_tags FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tags"
    ON watchlist_tags FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tags"
    ON watchlist_tags FOR DELETE
    USING (auth.uid() = user_id);

-- Junction table for many-to-many relationship
CREATE TABLE watchlist_item_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    watchlist_item_id UUID NOT NULL REFERENCES watchlist_items(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES watchlist_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(watchlist_item_id, tag_id)
);

-- Enable RLS
ALTER TABLE watchlist_item_tags ENABLE ROW LEVEL SECURITY;

-- RLS policies (check through watchlist_items -> watchlists -> user_id)
CREATE POLICY "Users can view tags on their items"
    ON watchlist_item_tags FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM watchlist_items wi
            JOIN watchlists w ON wi.watchlist_id = w.id
            WHERE wi.id = watchlist_item_id AND w.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can add tags to their items"
    ON watchlist_item_tags FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM watchlist_items wi
            JOIN watchlists w ON wi.watchlist_id = w.id
            WHERE wi.id = watchlist_item_id AND w.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can remove tags from their items"
    ON watchlist_item_tags FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM watchlist_items wi
            JOIN watchlists w ON wi.watchlist_id = w.id
            WHERE wi.id = watchlist_item_id AND w.user_id = auth.uid()
        )
    );

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON watchlist_tags TO authenticated;
GRANT SELECT, INSERT, DELETE ON watchlist_item_tags TO authenticated;

-- Index for faster lookups
CREATE INDEX idx_watchlist_item_tags_item ON watchlist_item_tags(watchlist_item_id);
CREATE INDEX idx_watchlist_item_tags_tag ON watchlist_item_tags(tag_id);
