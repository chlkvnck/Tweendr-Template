-- Create table for all tweets (both text and picture)
-- Using composite primary key (id, tweet_type) to allow same ID for different types
CREATE TABLE tweets (
  id INTEGER NOT NULL,
  tweet_type TEXT NOT NULL CHECK (tweet_type IN ('text', 'picture')),
  full_text TEXT NOT NULL,
  expanded_url TEXT NOT NULL,
  is_good BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  PRIMARY KEY (id, tweet_type)
);

-- Create indexes for faster queries
CREATE INDEX idx_tweets_type ON tweets(tweet_type);
CREATE INDEX idx_tweets_is_good ON tweets(is_good);
CREATE INDEX idx_tweets_type_and_status ON tweets(tweet_type, is_good);

-- Enable Row Level Security
ALTER TABLE tweets ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read tweets
CREATE POLICY "Allow public read access" ON tweets
  FOR SELECT USING (true);

-- Allow anyone to insert tweets
CREATE POLICY "Allow public insert access" ON tweets
  FOR INSERT WITH CHECK (true);

-- Allow anyone to update tweets (for categorizing)
CREATE POLICY "Allow public update access" ON tweets
  FOR UPDATE USING (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at when a tweet is modified
CREATE TRIGGER update_tweets_updated_at
  BEFORE UPDATE ON tweets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
