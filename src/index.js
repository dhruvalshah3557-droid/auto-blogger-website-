const cron = require('node-cron');
const config = require('./config');
const { fetchPosts } = require('./rss');
const { BlogUploader } = require('./uploader');
const { nextTopic } = require('./topics');
const { generateArticle, saveArticle } = require('./generator');
const { loadRegisterTitles, addRegisterEntry, loadRegister } = require('./register');
const { DuplicateChecker } = require('./duplicate-checker');
const { HeroImageProcessor } = require('./hero-image-processor');
const path = require('path');
const fs = require('fs');

const CONTENT_DIR = path.join(__dirname, '..', 'content');

/**
 * ========================================
 * MAIN WORKFLOW WITH FULL INTEGRATION
 * ========================================
 * 
 * Flow:
 * 1. Generate Article Content
 * 2. Check for Duplicates (VERIFY → CHECK)
 * 3. Generate Hero Image
 * 4. Process Hero Image (VERIFY → CHECK → OPTIMIZE → VALIDATE)
 * 5. Upload Article + Image (UPLOAD)
 * 6. Register in Database
 */

async function runLlmCycle() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 STARTING LLM CYCLE - ARTICLE GENERATION WITH HERO IMAGES');
  console.log('='.repeat(80));

  const existingTitles = await loadRegisterTitles();
  const duplicateChecker = new DuplicateChecker();
  const imageProcessor = new HeroImageProcessor({
    width: 1600,
    height: 900,
    maxFileSize: 500000, // 500KB
    quality: 95,
    format: 'jpeg'
  });

  const articles = [];

  for (let i = 0; i < config.articlesPerRun; i++) {
    console.log('\n' + '-'.repeat(80));
    console.log(`📝 ARTICLE ${i + 1}/${config.articlesPerRun}`);
    console.log('-'.repeat(80));

    try {
      // ====== STEP 1: GENERATE ARTICLE CONTENT ======
      const topic = await nextTopic(existingTitles);
      console.log(`\n📋 Topic: "${topic}"`);
      console.log('⏳ Generating article content...');

      const article = await generateArticle(topic, existingTitles);
      const { filePath, safeSlug, imageFilename } = saveArticle(article);
      
      console.log(`✅ Article generated: ${path.basename(filePath)}`);

      // ====== STEP 2: CHECK FOR DUPLICATES ======
      console.log('\n🔍 Checking for duplicate content...');
      
      const duplicateCheckOptions = {
        semanticThreshold: Number(process.env.SEMANTIC_SIMILARITY_THRESHOLD || 0.88),
        maxPerCategory: Number(process.env.MAX_ARTICLES_PER_CATEGORY || 2),
        failOnSaturation: process.env.FAIL_ON_SATURATION === 'true'
      };

      const dupCheck = await duplicateChecker.runFullDuplicateCheck(article, duplicateCheckOptions);

      if (!dupCheck.isApproved) {
        console.log('\n' + duplicateChecker.formatResults(dupCheck));
        console.log(`❌ SKIPPED: Article rejected due to duplicates`);
        
        // Log rejection
        logPublicationEvent({
          type: 'SKIPPED_DUPLICATE',
          title: article.h1,
          reason: dupCheck.errors[0] || 'Duplicate content detected',
          details: dupCheck
        });

        existingTitles.push(`[SKIPPED] ${article.h1}`);
        continue;
      }

      console.log('✅ Duplicate check passed');
      if (dupCheck.warnings.length > 0) {
        console.log('⚠️  Warnings:');
        dupCheck.warnings.forEach(w => console.log(`   - ${w}`));
      }

      // ====== STEP 3: GENERATE HERO IMAGE ======
      console.log('\n🎨 Generating hero image with branding...');

      let heroImagePath = null;
      
      if (config.enableAIImageGeneration || config.enableTemplateImages) {
        try {
          // Option A: AI-generated image
          if (config.enableAIImageGeneration) {
            heroImagePath = await generateAIHeroImage(article, imageFilename);
          }
          // Option B: Template-based image
          else if (config.enableTemplateImages) {
            heroImagePath = await generateTemplateHeroImage(article, imageFilename);
          }

          if (!heroImagePath) {
            throw new Error('Hero image generation returned null');
          }

          console.log(`✅ Hero image file created: ${path.basename(heroImagePath)}`);
          article.imagePath = heroImagePath;

        } catch (err) {
          console.error(`⚠️  Hero image generation failed: ${err.message}`);
          console.log('⚠️  Continuing without hero image (can be added manually later)');
          
          logPublicationEvent({
            type: 'WARNING_NO_IMAGE',
            title: article.h1,
            reason: `Hero image generation failed: ${err.message}`
          });
        }
      }

      // ====== STEP 4: PROCESS & VALIDATE HERO IMAGE ======
      if (article.imagePath) {
        console.log('\n📤 Processing and validating hero image...');

        const processResult = await imageProcessor.processAndUploadImage(
          article.imagePath,
          path.join(CONTENT_DIR, imageFilename),
          null, // uploader not needed yet
          article
        );

        if (!processResult.success) {
          console.log(`\n⚠️  Image processing failed but article can continue`);
          console.log('   Errors:', processResult.steps.optimize?.errors || processResult.steps.validateOutput?.errors);
          
          article.imagePath = null; // Don't upload image if validation failed
          
          logPublicationEvent({
            type: 'WARNING_IMAGE_VALIDATION_FAILED',
            title: article.h1,
            reason: 'Image validation failed',
            details: processResult
          });
        } else {
          console.log('\n✅ Image processing completed successfully');
          article.imagePath = path.join(CONTENT_DIR, imageFilename);
        }
      }

      // ====== STEP 5: REGISTER ARTICLE IN DATABASE ======
      console.log('\n📋 Registering article in database...');

      await addRegisterEntry({
        PublicationDate: new Date().toISOString().split('T')[0],
        ArticleTitle: article.h1,
        URL: `https://www.colourdiam.com/blog/${safeSlug}`,
        PrimaryKeyword: article.primaryKeyword,
        SupportingKeywords: (article.supportingKeywords || []).join('; '),
        SearchIntent: article.searchIntent,
        TopicCategory: article.topicCategory,
        InternalPagesLinked: (article.internalPagesLinked || []).join('; '),
        PublishingStatus: 'Draft (Pending Upload)',
        PerformanceResults: '',
      });

      console.log('✅ Article registered');

      articles.push(article);
      existingTitles.push(article.h1);

      logPublicationEvent({
        type: 'GENERATED',
        title: article.h1,
        reason: 'Article successfully generated and validated',
        details: {
          slug: safeSlug,
          hasImage: !!article.imagePath,
          imageSize: article.imagePath ? fs.statSync(article.imagePath).size : 0
        }
      });

    } catch (err) {
      console.error(`\n❌ Article generation failed: ${err.message}`);
      console.error(err.stack);

      logPublicationEvent({
        type: 'FAILED',
        title: 'Unknown',
        reason: `Article generation error: ${err.message}`
      });
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`✅ LLM CYCLE COMPLETE - ${articles.length} articles ready for upload`);
  console.log('='.repeat(80) + '\n');

  return articles;
}

/**
 * UPLOAD ARTICLES WITH IMAGES
 */
async function uploadArticles(articles) {
  if (articles.length === 0) {
    console.log('\n⚠️  No articles to upload');
    return;
  }

  console.log('\n' + '='.repeat(80));
  console.log(`🚀 STARTING UPLOAD - ${articles.length} ARTICLES WITH HERO IMAGES`);
  console.log('='.repeat(80));

  const uploader = new BlogUploader(config);
  let successCount = 0;
  let failureCount = 0;

  try {
    await uploader.launch();
    console.log('✅ Browser launched');

    await uploader.login();
    console.log('✅ Logged in to admin panel');

    for (let idx = 0; idx < articles.length; idx++) {
      const article = articles[idx];
      
      console.log('\n' + '-'.repeat(80));
      console.log(`📤 UPLOADING ARTICLE ${idx + 1}/${articles.length}`);
      console.log(`   Title: "${article.h1}"`);
      if (article.imagePath) {
        console.log(`   Image: ${path.basename(article.imagePath)}`);
      }
      console.log('-'.repeat(80));

      try {
        // ====== PRE-UPLOAD VERIFICATION ======
        console.log('\n🔍 Pre-upload verification...');

        // Check 1: Article not already published
        const isAlreadyPublished = await checkIfAlreadyPublished(article.h1);
        if (isAlreadyPublished) {
          throw new Error(`Article "${article.h1}" already published on ${isAlreadyPublished.date}`);
        }
        console.log('✅ Not previously published');

        // Check 2: Hero image exists (if expected)
        if (article.imagePath) {
          if (!fs.existsSync(article.imagePath)) {
            throw new Error(`Hero image file not found: ${article.imagePath}`);
          }
          console.log(`✅ Hero image file exists`);

          // Verify image one more time before upload
          const fileStats = fs.statSync(article.imagePath);
          if (fileStats.size === 0) {
            throw new Error('Hero image file is empty');
          }
          console.log(`✅ Image file valid (${(fileStats.size / 1024).toFixed(2)}KB)`);
        }

        // ====== UPLOAD TO BLOG ======
        console.log('\n⬆️  Uploading to blog admin panel...');

        const post = {
          title: article.h1,
          description: article.excerpt,
          content: article.articleHtml,
          imagePath: article.imagePath,
          imageAlt: article.imageAlt || `${article.h1} - Diamond & Jewellery Blog`,
          imageCaption: article.imageCaption || article.primaryKeyword,
          slug: article.slug,
          primaryKeyword: article.primaryKeyword
        };

        await uploader.uploadPost(post);

        console.log(`\n✅ PUBLISHED SUCCESSFULLY`);
        console.log(`   URL: https://www.colourdiam.com/blog/${article.slug}`);

        // ====== UPDATE DATABASE ======
        console.log('📋 Updating publication status...');
        await updatePublicationStatus(article.h1, 'Published');

        successCount++;

        logPublicationEvent({
          type: 'UPLOADED',
          title: article.h1,
          reason: 'Article successfully uploaded with hero image',
          details: {
            url: `https://www.colourdiam.com/blog/${article.slug}`,
            hasImage: !!article.imagePath
          }
        });

      } catch (err) {
        console.error(`\n❌ UPLOAD FAILED: ${err.message}`);
        failureCount++;

        logPublicationEvent({
          type: 'UPLOAD_FAILED',
          title: article.h1,
          reason: `Upload error: ${err.message}`
        });

        // Continue to next article instead of crashing
        continue;
      }
    }

  } catch (err) {
    console.error(`\n❌ FATAL ERROR: ${err.message}`);
    console.error(err.stack);
  } finally {
    await uploader.close();
  }

  console.log('\n' + '='.repeat(80));
  console.log(`📊 UPLOAD SUMMARY`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failureCount}`);
  console.log(`   Total: ${articles.length}`);
  console.log('='.repeat(80) + '\n');
}

/**
 * GENERATE AI HERO IMAGE
 */
async function generateAIHeroImage(article, filename) {
  const HeroImageGenerator = require('./hero-image-generator');
  const generator = new HeroImageGenerator(config.branding);

  console.log('   Using AI image generation...');
  const generatedImage = await generator.generateImageViaAPI(
    article,
    config.imageProvider || 'replicate'
  );

  const outputPath = path.join(CONTENT_DIR, filename);
  const imageBuffer = await downloadImage(generatedImage.imageUrl);
  
  // Add branding overlay
  const brandedImage = await addBrandingOverlay(imageBuffer, article, config.branding);
  await brandedImage.write(outputPath);

  return outputPath;
}

/**
 * GENERATE TEMPLATE HERO IMAGE
 */
async function generateTemplateHeroImage(article, filename) {
  console.log('   Using template-based image...');
  
  const Jimp = require('jimp');
  const canvas = new Jimp(1600, 900, config.branding?.primary || '#1a1a2e');

  // Add text overlay
  const font = await Jimp.loadFont(Jimp.FONT_SANS_64_BLACK);
  const title = article.h1.substring(0, 50);

  canvas.print(
    font,
    100,
    350,
    title,
    1400,
    { alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT }
  );

  const outputPath = path.join(CONTENT_DIR, filename);
  await canvas.write(outputPath);

  return outputPath;
}

/**
 * CHECK IF ARTICLE ALREADY PUBLISHED
 */
async function checkIfAlreadyPublished(title) {
  const register = await loadRegister();
  const found = register.find(a => 
    a.title?.toLowerCase() === title.toLowerCase() && 
    a.status?.includes('Published')
  );
  return found ? { date: new Date().toISOString() } : null;
}

/**
 * UPDATE PUBLICATION STATUS
 */
async function updatePublicationStatus(title, status) {
  // This would need to be implemented based on your register system
  // For now, just log it
  console.log(`   Status updated: ${status}`);
}

/**
 * LOGGING UTILITY
 */
function logPublicationEvent(event) {
  const log = {
    timestamp: new Date().toISOString(),
    type: event.type,
    title: event.title,
    reason: event.reason || '',
    details: event.details || {}
  };

  const logFile = path.join(CONTENT_DIR, '..', 'publication-events.log');
  fs.appendFileSync(logFile, JSON.stringify(log) + '\n');

  const statusIcon = {
    'GENERATED': '📝',
    'SKIPPED_DUPLICATE': '⏭️',
    'UPLOADED': '✅',
    'FAILED': '❌',
    'WARNING_NO_IMAGE': '⚠️',
    'UPLOAD_FAILED': '❌'
  }[event.type] || '📋';

  console.log(`${statusIcon} ${event.type}: ${event.reason}`);
}

/**
 * SCHEDULED EXECUTION
 */
async function runOnce() {
  try {
    if (config.contentMode === 'rss') {
      // RSS mode: fetch and upload from feed
      if (!config.rssFeedUrl) {
        throw new Error('CONTENT_MODE=rss requires RSS_FEED_URL in .env');
      }
      const { posts } = await fetchPosts(config.rssFeedUrl);
      console.log(`📰 Fetched ${posts.length} posts from RSS feed`);
      await uploadArticles(posts);
      return;
    }

    // LLM mode: generate and upload
    const articles = await runLlmCycle();
    
    if (config.autoUpload) {
      await uploadArticles(articles);
    } else {
      console.log(`\n📝 Generated ${articles.length} article(s)`);
      console.log('⚠️  AUTO_UPLOAD=false, so articles were NOT uploaded');
      console.log('   Review files in content/ and then manually enable AUTO_UPLOAD=true');
    }

  } catch (err) {
    console.error('❌ Fatal error in runOnce:', err);
    process.exit(1);
  }
}

/**
 * START SCHEDULER
 */
async function main() {
  if (config.runOnce) {
    console.log('🔄 Running once mode (RUN_ONCE=true)');
    await runOnce();
    process.exit(0);
  }

  console.log(`⏱️  Scheduler started`);
  console.log(`   Mode: ${config.contentMode}`);
  console.log(`   Schedule: ${config.schedule}`);
  console.log(`   Auto-upload: ${config.autoUpload}`);

  // Run immediately on start
  console.log('🚀 Running immediately...');
  runOnce().catch((err) => console.error('Error in initial run:', err));

  // Then run on schedule
  cron.schedule(config.schedule, () => {
    console.log('\n⏰ Scheduled run triggered');
    runOnce().catch((err) => console.error('Error in scheduled run:', err));
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

module.exports = { runLlmCycle, uploadArticles, runOnce };
