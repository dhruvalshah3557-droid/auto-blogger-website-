const cron = require('node-cron');
const config = require('./config');
const { fetchPosts } = require('./rss');
const { BlogUploader } = require('./uploader');

async function runOnce() {
  const { posts } = await fetchPosts(config.rssFeedUrl);
  console.log(`Fetched ${posts.length} posts from feed.`);
  if (posts.length === 0) {
    console.log('No posts to upload.');
    return;
  }

  const uploader = new BlogUploader(config);
  try {
    await uploader.launch();
    await uploader.login();
    for (const post of posts) {
      try {
        await uploader.uploadPost(post);
      } catch (err) {
        console.error(`Failed to upload "${post.title}": ${err.message}`);
      }
    }
  } finally {
    await uploader.close();
  }
}

async function main() {
  if (config.runOnce) {
    await runOnce();
    process.exit(0);
  }

  console.log(`Scheduler started. Uploading on cron: "${config.schedule}"`);
  cron.schedule(config.schedule, () => {
    runOnce().catch((err) => console.error('Scheduled run failed:', err));
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
