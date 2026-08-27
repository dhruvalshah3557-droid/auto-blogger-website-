# Copilot AI SEO Blog Automation Plan
## with Duplicate Detection & Prevention System

## Vision
Fully automated, AI-driven blog content generation system that improves ColourDiam's organic search visibility by automatically creating SEO-optimized blog posts linked to your product pages—**with intelligent duplicate detection to never publish the same article twice**.

---

## Phase 1: Duplicate Detection & Prevention System

### 1.1 Multi-Layer Duplicate Check

**BEFORE generating a new article:**

```javascript
// src/duplicate-checker.js
class DuplicateChecker {
  
  // Layer 1: Exact Title Match (Register)
  async checkExactTitle(title) {
    const register = await loadRegisterTitles();
    return register.includes(title);
  }

  // Layer 2: Semantic Similarity (AI-powered)
  async checkSemanticSimilarity(topic, embeddings) {
    // Compare embeddings of new topic vs. published articles
    // Flag if similarity > 85%
    // Prevents: "Pink Diamonds" vs "Pink Diamond Buying Guide"
  }

  // Layer 3: Keyword Overlap Check
  async checkKeywordOverlap(primaryKeyword, supportingKeywords) {
    const register = await loadRegister();
    for (const article of register) {
      const overlap = calculateKeywordOverlap(
        primaryKeyword, 
        article.primaryKeyword
      );
      if (overlap > 80%) {
        return { isDuplicate: true, similarArticle: article };
      }
    }
    return { isDuplicate: false };
  }

  // Layer 4: Content Hash Check (URL slug deduplication)
  async checkSlugExists(slug) {
    const published = await getPublishedBlogPosts();
    return published.some(p => p.slug === slug);
  }
}

// Usage in index.js:
async function checkBeforeGeneration(topic) {
  const checker = new DuplicateChecker();
  
  const titleMatch = await checker.checkExactTitle(topic);
  if (titleMatch) {
    console.warn(`❌ DUPLICATE: "${topic}" already published`);
    return false;
  }

  const semantic = await checker.checkSemanticSimilarity(topic);
  if (semantic.isDuplicate) {
    console.warn(`⚠️  SIMILAR: "${topic}" is 85% similar to "${semantic.similarArticle.title}"`);
    return false;
  }

  const keywordOverlap = await checker.checkKeywordOverlap(topic);
  if (keywordOverlap.isDuplicate) {
    console.warn(`⚠️  KEYWORD OVERLAP: "${topic}" overlaps with "${keywordOverlap.similarArticle.title}"`);
    return false;
  }

  console.log(`✅ UNIQUE: "${topic}" is safe to publish`);
  return true;
}
```

### 1.2 Enhanced Register System

Track every published article in CSV:

```csv
PublicationDate,ArticleTitle,URL,PrimaryKeyword,SupportingKeywords,SearchIntent,TopicCategory,InternalPagesLinked,PublishingStatus,PerformanceResults
2025-01-15,How to Choose Pink Diamonds: A Buyer's Guide,https://www.colourdiam.com/blog/how-to-choose-pink-diamonds,Pink Diamonds,"Fancy Pink, Expensive Diamonds, Diamond Certification",Commercial,Diamonds,/diamonds;/product;/education,Published,
2025-01-14,Fancy Vivid Yellow Diamonds vs Intense: Key Differences,https://www.colourdiam.com/blog/yellow-diamonds-vivid-vs-intense,Yellow Diamonds,"Fancy Vivid, Diamond Color, Gemstone Quality",Informational,Diamonds,/diamonds;/education,Published,
```

### 1.3 Database of Published Articles

Create a persistent database (JSON or SQLite):

```javascript
// src/published-articles.json
{
  "articles": [
    {
      "id": "uuid-123",
      "title": "How to Choose Pink Diamonds: A Buyer's Guide",
      "slug": "how-to-choose-pink-diamonds",
      "url": "https://www.colourdiam.com/blog/how-to-choose-pink-diamonds",
      "primaryKeyword": "Pink Diamonds",
      "supportingKeywords": ["Fancy Pink", "Expensive Diamonds", "Diamond Certification"],
      "publishedAt": "2025-01-15T10:30:00Z",
      "topicCategory": "Diamonds",
      "semanticHash": "abc123def456"  // For AI similarity detection
    }
  ]
}
```

---

## Phase 2: Smart Topic Generation

### 2.1 Topic Pool with Tracking

Maintain topics and track generation count:

```javascript
// src/topic-pool.js
const TOPIC_POOL = {
  'Pink Diamonds': {
    generated: 2,
    published: 2,
    lastPublished: '2025-01-15',
    relatedTopics: ['Fancy Pink', 'Pink Diamond Rings', 'Colored Diamond Certification']
  },
  'Yellow Diamonds': {
    generated: 1,
    published: 1,
    lastPublished: '2025-01-14',
    relatedTopics: ['Fancy Vivid Yellow', 'Golden Diamonds']
  },
  'Engagement Rings': {
    generated: 0,
    published: 0,
    lastPublished: null,
    relatedTopics: ['Diamond Rings', 'Luxury Engagement', 'Bespoke Rings']
  }
};

// Prevent: Generating "Pink Diamonds" 3 times
async function nextTopic(existingTitles) {
  let selectedTopic = null;
  let attempts = 0;
  
  while (!selectedTopic && attempts < 10) {
    const topic = getRandomUnpublishedTopic();
    
    // Check if this topic has been generated too many times
    if (TOPIC_POOL[topic].published >= 2) {
      console.log(`⏭️  Skip "${topic}" (already 2 published articles)`);
      markTopicAsUsed(topic);
      attempts++;
      continue;
    }
    
    // Check against existing titles for semantic similarity
    const hasSimilar = existingTitles.some(t => 
      calculateSimilarity(topic, t) > 0.85
    );
    
    if (hasSimilar) {
      console.log(`⏭️  Skip "${topic}" (semantically similar to existing article)`);
      attempts++;
      continue;
    }
    
    selectedTopic = topic;
  }
  
  if (!selectedTopic) {
    throw new Error('No unique topics available. Expand TOPIC_POOL.');
  }
  
  console.log(`✅ Selected topic: "${selectedTopic}"`);
  return selectedTopic;
}
```

### 2.2 Topic Diversity Requirements

Ensure variety across articles:

```javascript
// Each week, require:
// - 2-3 articles on Diamonds (different colors/aspects)
// - 1-2 articles on Jewellery (rings, design, trends)
// - 1 article on Education (4Cs, certification, grading)
// - 1 article on Buying Guide (how to buy, tips, investment)
// - 1 article on Trends/News (industry news, market updates)

const WEEKLY_DISTRIBUTION = {
  'Diamonds': { target: 3, weight: 0.40 },
  'Jewellery': { target: 2, weight: 0.25 },
  'Education': { target: 1, weight: 0.15 },
  'Buying Guide': { target: 1, weight: 0.15 },
  'Trends': { target: 1, weight: 0.05 }
};
```

---

## Phase 3: Content Generation with Duplication Safeguards

### 3.1 Enhanced LLM Prompt

```javascript
// Updated SYSTEM_PROMPT in generator.js
const SYSTEM_PROMPT = `You are the SEO Content Director for ColourDiam.

**CRITICAL: NEVER GENERATE DUPLICATE CONTENT**

Previously published articles (DO NOT repeat topics, structures, or arguments):
${existingTitles.join('\n')}

Generate ONLY completely original content that:
1. Does NOT repeat the topic of any published article
2. Does NOT duplicate the main argument/structure
3. Does NOT cover the same keywords as existing articles
4. Brings a NEW PERSPECTIVE or NEW INFORMATION

If the requested topic would duplicate an existing article, REFUSE to generate and explain why.

...
`;
```

### 3.2 AI Deduplication Validation

After LLM generates content:

```javascript
// src/validate-uniqueness.js
async function validateContentUniqueness(newArticle) {
  const register = await loadRegister();
  
  // Check 1: Exact H1 match
  if (register.some(a => a.title === newArticle.h1)) {
    throw new Error(`❌ DUPLICATE H1: "${newArticle.h1}" already exists`);
  }
  
  // Check 2: Primary keyword match
  if (register.some(a => a.primaryKeyword === newArticle.primaryKeyword)) {
    throw new Error(`❌ DUPLICATE PRIMARY KEYWORD: "${newArticle.primaryKeyword}" already exists`);
  }
  
  // Check 3: Slug uniqueness
  if (register.some(a => a.slug === newArticle.slug)) {
    throw new Error(`❌ DUPLICATE SLUG: "${newArticle.slug}" already exists`);
  }
  
  // Check 4: Semantic similarity (vector embeddings)
  const similarity = await checkSemanticSimilarity(newArticle, register);
  if (similarity > 0.88) {
    throw new Error(`❌ CONTENT TOO SIMILAR (${similarity}%): Conflicts with "${register[similarity.matchId].title}"`);
  }
  
  console.log(`✅ Content is unique and safe to publish`);
  return true;
}
```

---

## Phase 4: Upload Safeguards

### 4.1 Pre-Upload Verification

```javascript
// In uploader.js
async function uploadPost(post) {
  // Step 1: Verify article not already published
  const isPublished = await checkIfAlreadyPublished(post.title, post.slug);
  if (isPublished) {
    throw new Error(`❌ ABORT UPLOAD: "${post.title}" already published on ${isPublished.date}`);
  }
  
  // Step 2: Check website for duplicate
  const existsOnWeb = await checkWebsiteForDuplicate(post.slug);
  if (existsOnWeb) {
    throw new Error(`❌ ABORT UPLOAD: Blog post already exists at URL`);
  }
  
  // Step 3: Upload
  await this._setSubject(post.title);
  await this._setBody(post.content);
  await this.page.click('#btnSave');
  
  // Step 4: Mark as published in register
  await addRegisterEntry({
    PublicationDate: new Date().toISOString().split('T')[0],
    ArticleTitle: post.title,
    URL: `https://www.colourdiam.com/blog/${post.slug}`,
    PrimaryKeyword: post.primaryKeyword,
    SupportingKeywords: post.supportingKeywords.join('; '),
    SearchIntent: post.searchIntent,
    TopicCategory: post.topicCategory,
    InternalPagesLinked: post.internalPages.join('; '),
    PublishingStatus: 'Published',
    PerformanceResults: '',
  });
  
  console.log(`✅ PUBLISHED: "${post.title}" on ${new Date().toISOString().split('T')[0]}`);
}
```

### 4.2 Logging & Alerts

```javascript
// src/logger.js
function logPublicationEvent(event) {
  const log = {
    timestamp: new Date().toISOString(),
    type: event.type, // 'GENERATED', 'SKIPPED_DUPLICATE', 'UPLOADED', 'FAILED'
    title: event.title,
    reason: event.reason || '',
    details: event.details || {}
  };
  
  fs.appendFileSync('publication-events.log', JSON.stringify(log) + '\n');
  
  if (event.type === 'SKIPPED_DUPLICATE') {
    console.warn(`⚠️  ${event.reason}`);
  }
}
```

---

## Phase 5: Website Structure & Internal Linking

### 5.1 Website Mapping

```javascript
// src/website-structure.js
const COLOURDIAM_STRUCTURE = {
  diamonds: {
    url: 'https://www.colourdiam.com/diamonds',
    keywords: ['fancy coloured diamonds', 'diamond buying', 'diamond certification'],
  },
  jewellery: {
    url: 'https://www.colourdiam.com/product',
    keywords: ['engagement rings', 'luxury jewellery', 'bespoke'],
  },
  education: {
    url: 'https://www.colourdiam.com/education',
    keywords: ['diamond education', '4Cs', 'diamond grading'],
  },
};
```

### 5.2 Automatic Internal Linking

```javascript
// src/link-matcher.js
function insertInternalLinks(articleHtml, primaryKeyword) {
  // Match article keywords to website pages
  // Insert 3-5 contextual links
  // Avoid link clustering
  // Use natural anchor text
}
```

---

## Phase 6: Configuration

### 6.1 .env Setup

```env
# Admin Panel
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_admin_password
ADMIN_LOGIN_URL=https://www.colourdiam.com/adminlogin
ADMIN_BLOG_URL=https://www.colourdiam.com/Admin/Blog

# Content Generation
CONTENT_MODE=llm
ARTICLES_PER_RUN=1
AUTO_UPLOAD=true
UPLOAD_SCHEDULE=0 * * * *

# LLM API
USER_LLM_BASE_URL=https://api.openai.com/v1
USER_LLM_API_KEY=your_key
USER_LLM_MODEL=gpt-4o-mini
LLM_TEMPERATURE=0.7

# Duplicate Prevention
ENABLE_DUPLICATE_CHECK=true
DUPLICATE_CHECK_LAYERS=exact,semantic,keyword,slug
SEMANTIC_SIMILARITY_THRESHOLD=0.88

# Topic Management
ENABLE_TOPIC_DIVERSITY=true
MAX_ARTICLES_PER_TOPIC=2
TOPIC_POOL_CSV=topics.csv

# Logging
ENABLE_PUBLICATION_LOG=true
LOG_FILE_PATH=publication-events.log
```

---

## Phase 7: Monitoring Dashboard

### 7.1 Publication Summary

```
PUBLICATION STATUS:
├─ Total Published: 47
├─ This Month: 12
├─ Duplicates Prevented: 8
├─ Avg. Words/Article: 1,456
└─ Avg. Internal Links: 4.2

UNIQUE TOPICS COVERED:
├─ Diamonds (Pink, Yellow, Blue): 18 articles
├─ Jewellery & Rings: 14 articles
├─ Education & 4Cs: 9 articles
└─ Buying Guides & Trends: 6 articles

QUALITY METRICS:
├─ Avg. SEO Score: 92/100
├─ All articles have schema markup: ✅
├─ All articles have internal links: ✅
└─ No duplicates published: ✅

RECENT ACTIVITY:
├─ Last Published: Today, 10:30 AM
├─ Next Scheduled: Today, 11:00 AM
└─ Articles in Queue: 2
```

---

## Implementation Checklist

- [ ] **Duplicate Checker Module** - Multi-layer validation
- [ ] **Enhanced Register** - CSV tracking of all articles
- [ ] **Published Articles Database** - JSON or SQLite
- [ ] **Topic Pool Manager** - Track generation counts
- [ ] **LLM Prompt Update** - Anti-duplication safeguards
- [ ] **Content Validation** - Post-generation uniqueness check
- [ ] **Pre-Upload Verification** - Final safety check
- [ ] **Internal Link Insertion** - Automatic linking
- [ ] **Logging & Alerts** - Track all events
- [ ] **Configuration (.env)** - Set duplicate thresholds
- [ ] **Testing** - Verify duplicate prevention works

---

## Key Success Metrics

✅ **Zero Duplicate Articles Published**  
✅ **50+ Unique Blog Posts in 3 Months**  
✅ **Diverse Topic Coverage** (Not 10 articles about "Pink Diamonds")  
✅ **100% Uniqueness Verified** (AI + Human validation)  
✅ **Internal Links Automatically Inserted** (3-5 per article)  
✅ **Automatic Google Sheet Tracking** (All metadata logged)  

---

**Status**: Ready for Development  
**Created**: 2026-08-27  
**Branch**: `features/copilot/plans`
