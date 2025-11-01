// app.js - the application logic for Tweet Likes Viewer
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://qrzowdnqrxcgewluswuc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyem93ZG5xcnhjZ2V3bHVzd3VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5NDI1NjEsImV4cCI6MjA3NzUxODU2MX0.bQmWJpBxH5AsRCZenQZEqUc1dSqvk6BVQRq41d8SHHc';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TWEETS_PER_LOAD = 50;
let currentTab = 'text'; // or 'pictures'
let currentSubTab = 'unsorted'; // or 'good' or 'bad'
let textTweets = [];
let pictureTweets = [];
let textOffset = 0;
let picturesOffset = 0;
let isLoading = false;

const tabToType = tab => tab === 'pictures' ? 'picture' : 'text';

function $(id) { return document.getElementById(id); }
function gen(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  Object.assign(el, props);
  (children || []).forEach(c => { if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function clearList(type) {
  if (type === 'text') $('text-list').innerHTML = '';
  if (type === 'pictures') $('pictures-list').innerHTML = '';
}

// Counts storage
let counts = {
  text: { total: 0, unsorted: 0, good: 0, bad: 0 },
  picture: { total: 0, unsorted: 0, good: 0, bad: 0 }
};

// Fetch counts from Supabase
async function fetchCounts() {
  try {
    // Get text tweet counts
    const { count: textTotal } = await supabase
      .from('tweets')
      .select('*', { count: 'exact', head: true })
      .eq('tweet_type', 'text');
    
    const { count: textGood } = await supabase
      .from('tweets')
      .select('*', { count: 'exact', head: true })
      .eq('tweet_type', 'text')
      .eq('is_good', true);
    
    const { count: textBad } = await supabase
      .from('tweets')
      .select('*', { count: 'exact', head: true })
      .eq('tweet_type', 'text')
      .eq('is_good', false);
    
    // Get picture tweet counts
    const { count: pictureTotal } = await supabase
      .from('tweets')
      .select('*', { count: 'exact', head: true })
      .eq('tweet_type', 'picture');
    
    const { count: pictureGood } = await supabase
      .from('tweets')
      .select('*', { count: 'exact', head: true })
      .eq('tweet_type', 'picture')
      .eq('is_good', true);
    
    const { count: pictureBad } = await supabase
      .from('tweets')
      .select('*', { count: 'exact', head: true })
      .eq('tweet_type', 'picture')
      .eq('is_good', false);
    
    counts.text = {
      total: textTotal || 0,
      good: textGood || 0,
      bad: textBad || 0,
      unsorted: (textTotal || 0) - (textGood || 0) - (textBad || 0)
    };
    
    counts.picture = {
      total: pictureTotal || 0,
      good: pictureGood || 0,
      bad: pictureBad || 0,
      unsorted: (pictureTotal || 0) - (pictureGood || 0) - (pictureBad || 0)
    };
    
    updateCountsUI();
  } catch (error) {
    console.error('Error fetching counts:', error);
  }
}

function updateCountsUI() {
  // Update main tab buttons
  document.querySelectorAll('.tab-button').forEach(btn => {
    const tab = btn.dataset.tab;
    const count = tab === 'text' ? counts.text.total : counts.picture.total;
    btn.textContent = tab === 'text' ? `TEXT (${count})` : `PICTURES (${count})`;
  });
  
  // Update sub-tab buttons for text
  document.querySelectorAll('#text-sub-tabs .sub-tab-button').forEach(btn => {
    const subTab = btn.dataset.subTab;
    const baseText = subTab.toUpperCase();
    const count = counts.text[subTab] || 0;
    btn.textContent = `${baseText} (${count})`;
  });
  
  // Update sub-tab buttons for pictures
  document.querySelectorAll('#pictures-sub-tabs .sub-tab-button').forEach(btn => {
    const subTab = btn.dataset.subTab;
    const baseText = subTab.toUpperCase();
    const count = counts.picture[subTab] || 0;
    btn.textContent = `${baseText} (${count})`;
  });
}

function setActiveTabUI() {
  // main tabs
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === currentTab);
  });
  // containers
  $('text-container').classList.toggle('active', currentTab === 'text');
  $('pictures-container').classList.toggle('active', currentTab === 'pictures');
  // sub-tabs for current container
  document.querySelectorAll('.sub-tab-button').forEach(btn => {
    btn.classList.remove('active');
  });
  const subTabId = currentTab === 'text' ? 'text-sub-tabs' : 'pictures-sub-tabs';
  document.querySelectorAll(`#${subTabId} .sub-tab-button`).forEach(btn => {
    btn.classList.toggle('active', btn.dataset.subTab === currentSubTab);
  });
}

async function fetchTweets(tab, offset) {
  const tweetType = tabToType(tab);
  console.log('Fetching from Supabase:', {tweetType, offset, batch: TWEETS_PER_LOAD});
  const { data, error } = await supabase
    .from('tweets')
    .select('*')
    .eq('tweet_type', tweetType)
    .order('id', { ascending: true })
    .range(offset, offset + TWEETS_PER_LOAD - 1);
  if (error) throw error;
  return data.map(row => ({
    like: { fullText: row.full_text, expandedUrl: row.expanded_url },
    id: row.id,
    isGood: row.is_good
  }));
}

function getFiltered(tweets, filter) {
  if (filter === 'good') return tweets.filter(t => t.isGood === true);
  if (filter === 'bad') return tweets.filter(t => t.isGood === false);
  return tweets.filter(t => t.isGood == null);
}
function getPhotoUrl(expandedUrl, fullText) {
  // Use t.co link from fullText if available, otherwise fallback to expandedUrl
  const tcoMatch = fullText.match(/https:\/\/t\.co\/[a-zA-Z0-9]+/);
  return tcoMatch ? tcoMatch[0] : expandedUrl;
}

function createTweetElement(tweet) {
  const frame = gen('div', { className: 'tweet-frame', 'data-tweet-id': tweet.id });
  
  // ID container with inline View Image button for pictures
  const idContainer = gen('div', { className: 'tweet-id' });
  const idLink = gen('a', { href: tweet.like.expandedUrl, className: 'tweet-id-link', target: '_blank', textContent: `ID: ${tweet.id}` });
  idContainer.appendChild(idLink);
  
  if (currentTab === 'pictures') {
    const separator = gen('span', { className: 'id-separator', textContent: ' | ' });
    idContainer.appendChild(separator);
    
    const imgBtn = gen('a', {
      href: getPhotoUrl(tweet.like.expandedUrl, tweet.like.fullText),
      className: 'view-image-button-inline',
      target: '_blank',
      textContent: 'View Image'
    });
    idContainer.appendChild(imgBtn);
  }
  
  frame.appendChild(idContainer);
  frame.appendChild(gen('div', { className: 'tweet-text', textContent: tweet.like.fullText }));
  
  const cats = gen('div', { className: 'category-buttons' });
  const goodBtn = gen('button', { className: 'category-button good', textContent: 'GOOD', disabled: tweet.isGood === true });
  const badBtn = gen('button', { className: 'category-button bad', textContent: 'BAD', disabled: tweet.isGood === false });
  goodBtn.onclick = async () => { await categorizeTweet(tweet, true, frame); };
  badBtn.onclick = async () => { await categorizeTweet(tweet, false, frame); };
  cats.appendChild(goodBtn);
  cats.appendChild(badBtn);
  frame.appendChild(cats);
  return frame;
}

async function categorizeTweet(tweet, isGood, frame) {
  // Capture old status BEFORE updating
  const oldStatus = tweet.isGood === null ? 'unsorted' : (tweet.isGood === true ? 'good' : 'bad');
  const typeKey = currentTab === 'text' ? 'text' : 'picture';
  
  // Update tweet status
  tweet.isGood = isGood;
  
  // Save to Supabase
  await supabase.from('tweets')
    .update({ is_good: isGood })
    .eq('id', tweet.id)
    .eq('tweet_type', tabToType(currentTab));
  
  // Update counts locally - decrement old status, increment new status
  const newStatus = isGood ? 'good' : 'bad';
  
  if (oldStatus !== newStatus) {
    // Decrement old category
    if (counts[typeKey][oldStatus] > 0) {
      counts[typeKey][oldStatus]--;
    }
    // Increment new category
    counts[typeKey][newStatus] = (counts[typeKey][newStatus] || 0) + 1;
    
    // Update UI immediately
    updateCountsUI();
  }
  
  // Update button states
  frame.querySelector('.category-button.good').disabled = isGood === true;
  frame.querySelector('.category-button.bad').disabled = isGood === false;
  
  // Remove tweet from view if needed
  if (currentSubTab !== (isGood ? 'good' : 'bad') && currentSubTab !== 'unsorted') {
    frame.remove();
  }
  if (currentSubTab === 'unsorted') frame.remove();
  
  setActiveTabUI();
}

async function loadMoreTweets(batchReset=false) {
  if (isLoading) return;
  isLoading = true;
  let tweetsArr = currentTab === 'text' ? textTweets : pictureTweets;
  let offset = currentTab === 'text' ? textOffset : picturesOffset;
  const spinner = currentTab === 'text' ? $('text-loading') : $('pictures-loading');
  spinner.style.display = 'block';
  const batch = await fetchTweets(currentTab, offset);
  console.log('Loaded from Supabase:', {tab: currentTab, batchLength: batch.length});
  if (batchReset) {
    if (currentTab === 'text') {
      textTweets = batch;
      textOffset = batch.length;
    } else {
      pictureTweets = batch;
      picturesOffset = batch.length;
    }
  } else {
    if (currentTab === 'text') {
      textTweets = textTweets.concat(batch);
      textOffset += batch.length;
    } else {
      pictureTweets = pictureTweets.concat(batch);
      picturesOffset += batch.length;
    }
  }
  spinner.style.display = 'none';
  renderTweetList(true);
  isLoading = false;
  setActiveTabUI();
}

function renderTweetList(reset = false) {
  let tweets = currentTab === 'text' ? textTweets : pictureTweets;
  let filter = currentSubTab;
  const container = $(currentTab === 'text' ? 'text-list' : 'pictures-list');
  if (reset) container.innerHTML = '';
  getFiltered(tweets, filter).forEach(tweet => {
    if (!container.querySelector(`[data-tweet-id="${tweet.id}"]`)) {
      container.appendChild(createTweetElement(tweet));
    }
  });
  setActiveTabUI();
}

document.querySelectorAll('.tab-button').forEach(btn => btn.onclick = async () => {
  currentTab = btn.dataset.tab;
  currentSubTab = 'unsorted';
  textOffset = 0;
  picturesOffset = 0;
  await fetchCounts();
  setActiveTabUI();
  loadMoreTweets(true);
});
document.querySelectorAll('.sub-tab-button').forEach(btn => btn.onclick = () => {
  currentSubTab = btn.dataset.subTab;
  setActiveTabUI();
  renderTweetList(true);
});

async function renderInitial() {
  clearList('text');
  clearList('pictures');
  await fetchCounts();
  setActiveTabUI();
  loadMoreTweets(true);
}

window.addEventListener('scroll', () => {
  if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 300) {
    loadMoreTweets();
  }
});

renderInitial();
