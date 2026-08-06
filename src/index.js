const cron = require('node-cron');
const config = require('./config');
const { fetchPosts } = require('./rss');
const { BlogUploader } = require('./uploader');
const { nextTopic } = require('./topics');
const { generateArticle, saveArticle, generateHeroImage } = require('./generator');
const { loadRegisterTitles, addRegisterEntry } = require('./register');

async function runLlmCycle() {
  const existingTitles = await loadRegisterTitles();
  const articles = [];
  for (let i = 0; i < config.articlesPerRun; i++) {
    try {
      const topic = await nextTopic(existingTitles);
      console.log(`Generating article for topic: "${topic}"`);
      const article = await generateArticle(topic, existingTitles);
      const { filePath, safeSlug, imageFilename } = saveArticle(article);
      console.log(`Saved: ${filePath}`);

      let heroImagePath = null;
      try {
        heroImagePath = await generateHeroImage(article.h1, imageFilename);
        console.log(`Hero image generated: content/${imageFilename}`);
      } catch (err) {
        console.error(`Hero image generation failed for "${article.h1}": ${err.message}`);
      }
      article.imagePath = heroImagePath;

      await addRegisterEntry({
        PublicationDate: new Date().toISOString().slice(0, 10),
        ArticleTitle: article.h1,
        URL: `https://www.colourdiam.com/blog/${safeSlug}`,
        PrimaryKeyword: article.primaryKeyword,
        SupportingKeywords: (article.supportingKeywords || []).join('; '),
        SearchIntent: article.searchIntent,
        TopicCategory: article.topicCategory,
        InternalPagesLinked: (article.internalPagesLinked || []).join('; '),
        PublishingStatus: config.autoUpload ? 'Published (auto)' : 'Draft',
        PerformanceResults: '',
      });
      articles.push(article);
      existingTitles.push(article.h1);
    } catch (err) {
      console.error(`Article generation failed: ${err.message}`);
    }
  }
  return articles;
}

async function uploadArticles(articles) {
  if (articles.length === 0) return;
  const uploader = new BlogUploader(config);
  try {
    await uploader.launch();
    await uploader.login();
    for (const article of articles) {
      const post = {
        title: article.h1,
        description: article.excerpt,
        content: article.articleHtml,
        imagePath: article.imagePath,
      };
      try {
        await uploader.uploadPost(post);
      } catch (err) {
        console.error(`Failed to upload "${article.h1}": ${err.message}`);
      }
    }
  } finally {
    await uploader.close();
  }
}

async function runOnce() {
  if (config.contentMode === 'rss') {
    if (!config.rssFeedUrl) {
      throw new Error('CONTENT_MODE=rss requires RSS_FEED_URL in .env');
    }
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
    return;
  }

  const articles = await runLlmCycle();
  if (config.autoUpload) {
    await uploadArticles(articles);
  } else {
    console.log(`Generated ${articles.length} article(s). AUTO_UPLOAD=false, so nothing was uploaded. Review files in content/.`);
  }
}

async function main() {
  if (config.runOnce) {
    await runOnce();
    process.exit(0);
  }

  console.log(`Scheduler started. Mode=${config.contentMode}, cron="${config.schedule}"`);
  cron.schedule(config.schedule, () => {
    runOnce().catch((err) => console.error('Scheduled run failed:', err));
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
