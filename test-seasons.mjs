#!/usr/bin/env node

// Test script to verify season functionality
import { MediaType, MediaStatus } from './src/lib/types.js';
import { 
  extractSeasonFromAnimeTitle,
  createSeasonInfoFromAnime,
  formatSeasonDisplay,
  updateSeasonProgress
} from './src/lib/season-utils.js';

console.log('🧪 Testing Season Functionality\n');

// Test 1: Season extraction from anime titles
console.log('1. Testing season extraction from anime titles:');
const testTitles = [
  'Attack on Titan Season 2',
  'Demon Slayer: Kimetsu no Yaiba Season 2',
  'My Hero Academia S5',
  'Jujutsu Kaisen',
  'One Piece'
];

testTitles.forEach(title => {
  const result = extractSeasonFromAnimeTitle(title);
  console.log(`  "${title}" -> Season: ${result.seasonNumber || 'N/A'}, Clean: "${result.cleanTitle}"`);
});

// Test 2: Season info creation
console.log('\n2. Testing season info creation:');
const mockAnime = {
  mal_id: 123,
  title: 'Attack on Titan Season 2',
  images: { jpg: { image_url: 'test.jpg' } },
  episodes: 12,
  season: 'spring',
  year: 2017,
  score: 9.0
};

const seasonInfo = createSeasonInfoFromAnime(mockAnime);
console.log('  Season Info:', JSON.stringify(seasonInfo, null, 2));

// Test 3: Season display formatting
console.log('\n3. Testing season display formatting:');
console.log(`  Formatted: "${formatSeasonDisplay(seasonInfo)}"`);

// Test 4: Progress calculation
console.log('\n4. Testing progress calculation:');
const progressTests = [5, 12, 15, 24];
progressTests.forEach(progress => {
  const result = updateSeasonProgress(progress, seasonInfo);
  console.log(`  Progress ${progress} -> S${result.season}E${result.episode} (Complete: ${result.isSeasonComplete})`);
});

console.log('\n✅ Season functionality tests completed!');