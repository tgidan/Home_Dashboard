"use strict";

/* 
   `test-data.js` is used as fallback when RSS proxy is unreachable. (e.g. opening index.html directly via file://)
   Therefore, it fills TEST_FEEDS with standard entries. 
   Helps with testing of news feed container on sizes outside of the average person's screen.
*/

function makeDate(hoursBeforeWindowEnd) {
  // Anchor to the last 6 AM so articles always fall inside the current window
  const end = new Date();
  end.setHours(6, 0, 0, 0);
  if (end > new Date()) end.setDate(end.getDate() - 1);
  return new Date(end.getTime() - hoursBeforeWindowEnd * 3600 * 1000).toUTCString();
}

const TEST_FEEDS = {};
CONFIG.news.feeds.forEach(feed => {
  TEST_FEEDS[feed.id] = Array.from({ length: 20 }, (_, i) => ({
    title:   `Test${i + 1}`,
    link:    '#',
    pubDate: makeDate(i + 1),
  }));
});
