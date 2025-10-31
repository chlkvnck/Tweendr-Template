const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const SUPABASE_URL = 'https://qrzowdnqrxcgewluswuc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyem93ZG5xcnhjZ2V3bHVzd3VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5NDI1NjEsImV4cCI6MjA3NzUxODU2MX0.bQmWJpBxH5AsRCZenQZEqUc1dSqvk6BVQRq41d8SHHc';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Read textLikes.js
const textLikesPath = path.join(__dirname, 'textLikes.js');
let textContent = fs.readFileSync(textLikesPath, 'utf8');
const textMatch = textContent.match(/const textLikes2 = (\[[\s\S]*\])/);
if (!textMatch) {
    console.error('Could not parse textLikes.js');
    process.exit(1);
}

const textTweets = JSON.parse(textMatch[1]);

// Read pictureLikes.js
const pictureLikesPath = path.join(__dirname, 'pictureLikes.js');
let pictureContent = fs.readFileSync(pictureLikesPath, 'utf8');
const pictureMatch = pictureContent.match(/const pictureLikes2 = (\[[\s\S]*\])/);
if (!pictureMatch) {
    console.error('Could not parse pictureLikes.js');
    process.exit(1);
}

const pictureTweets = JSON.parse(pictureMatch[1]);

// Function to import tweets in batches
async function importTweets(tweets, tweetType) {
    console.log(`\nImporting ${tweets.length} ${tweetType} tweets...`);
    
    const batchSize = 1000; // Supabase recommends batches of 1000 or less
    let imported = 0;
    let errors = 0;
    
    for (let i = 0; i < tweets.length; i += batchSize) {
        const batch = tweets.slice(i, i + batchSize);
        
        // Transform to Supabase format
        const supabaseTweets = batch.map(tweet => ({
            id: tweet.id,
            tweet_type: tweetType,
            full_text: tweet.like.fullText,
            expanded_url: tweet.like.expandedUrl,
            is_good: tweet.isGood || null
        }));
        
        try {
            const { data, error } = await supabase
                .from('tweets')
                .upsert(supabaseTweets, {
                    onConflict: 'id,tweet_type',
                    ignoreDuplicates: false
                });
            
            if (error) {
                console.error(`Error importing batch ${Math.floor(i / batchSize) + 1}:`, error);
                errors += batch.length;
            } else {
                imported += batch.length;
                console.log(`  Batch ${Math.floor(i / batchSize) + 1}: Imported ${batch.length} tweets (${imported}/${tweets.length})`);
            }
        } catch (err) {
            console.error(`Error importing batch ${Math.floor(i / batchSize) + 1}:`, err);
            errors += batch.length;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`✓ ${tweetType}: ${imported} imported, ${errors} errors`);
    return { imported, errors };
}

// Main import function
async function main() {
    console.log('Starting tweet import to Supabase...\n');
    
    // Import text tweets
    const textResult = await importTweets(textTweets, 'text');
    
    // Import picture tweets
    const pictureResult = await importTweets(pictureTweets, 'picture');
    
    console.log('\n=== Import Summary ===');
    console.log(`Text tweets: ${textResult.imported} imported, ${textResult.errors} errors`);
    console.log(`Picture tweets: ${pictureResult.imported} imported, ${pictureResult.errors} errors`);
    console.log(`Total: ${textResult.imported + pictureResult.imported} tweets imported`);
    console.log('\nDone!');
}

main().catch(console.error);

