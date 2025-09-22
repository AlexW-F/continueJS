// Test cumulative season progress calculation
const { 
  calculateCumulativeEpisodes, 
  seasonEpisodeToTotal, 
  totalToSeasonEpisode,
  updateSeasonProgress 
} = require('./src/lib/season-utils.js');

console.log('🧪 Testing Cumulative Season Progress\n');

// Test scenario: Game of Thrones Season 3 Episode 7
// Assuming 10 episodes per season for simplicity
const seasonInfo = {
  currentSeason: 3,
  totalSeasons: 8,
  seasonName: "Season 3",
  episodesInSeason: 10,
  seasonYear: 2013
};

console.log('Game of Thrones Season 3 Episode 7:');
console.log('- User is watching Season 3');
console.log('- Each season has 10 episodes');
console.log('- Currently on Episode 7 of Season 3');
console.log('- Total progress should be: (2 seasons × 10 eps) + 7 = 27 episodes\n');

// Test 1: Convert Season/Episode to total progress
const totalProgress = seasonEpisodeToTotal(3, 7, 10);
console.log(`1. seasonEpisodeToTotal(3, 7, 10) = ${totalProgress}`);

// Test 2: Convert total progress back to Season/Episode  
const { season, episode } = totalToSeasonEpisode(27, 10);
console.log(`2. totalToSeasonEpisode(27, 10) = Season ${season}, Episode ${episode}`);

// Test 3: Calculate cumulative episodes for Season 3
const cumulativeEps = calculateCumulativeEpisodes(seasonInfo);
console.log(`3. calculateCumulativeEpisodes(Season 3) = ${cumulativeEps} total episodes`);

// Test 4: Update season progress with total episode count
const progressResult = updateSeasonProgress(27, seasonInfo);
console.log(`4. updateSeasonProgress(27, seasonInfo) =`, progressResult);

console.log('\n✅ Cumulative season progress tests completed!');
console.log('\n📝 Expected behavior:');
console.log('- When user selects Season 3 of Game of Thrones');  
console.log('- And enters progress "Episode 7"');
console.log('- System should calculate total progress as 27 episodes');
console.log('- Progress bar should show 27/80 = 33.8% (all 8 seasons × 10 eps)');
console.log('- Display should show "S3E7 of 10 • Season 3 of 8"');