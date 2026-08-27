const fs = require('fs');
const path = require('path');
const { loadRegister, loadRegisterTitles } = require('./register');

class DuplicateChecker {
  constructor() {
    this.register = null;
    this.existingTitles = null;
  }

  /**
   * Load register once for efficiency
   */
  async initializeRegister() {
    if (!this.register) {
      this.register = await loadRegister();
      this.existingTitles = this.register.map(r => r.title).filter(Boolean);
    }
  }

  /**
   * Layer 1: Exact Title Match
   * Check if article H1/title already exists in published articles
   */
  async checkExactTitle(title) {
    await this.initializeRegister();
    const normalized = this.normalize(title);
    const match = this.existingTitles.find(
      t => this.normalize(t) === normalized
    );
    return {
      isDuplicate: !!match,
      existingTitle: match,
      layer: 'EXACT_TITLE'
    };
  }

  /**
   * Layer 2: Semantic Similarity
   * Check if topic is semantically similar to published articles (85%+ match)
   * Uses simple string similarity algorithm
   */
  async checkSemanticSimilarity(topic, threshold = 0.85) {
    await this.initializeRegister();
    
    for (const existing of this.existingTitles) {
      const similarity = this.calculateSimilarity(topic, existing);
      if (similarity >= threshold) {
        return {
          isDuplicate: true,
          similarArticle: existing,
          similarity: Math.round(similarity * 100),
          layer: 'SEMANTIC_SIMILARITY'
        };
      }
    }
    
    return {
      isDuplicate: false,
      layer: 'SEMANTIC_SIMILARITY'
    };
  }

  /**
   * Layer 3: Keyword Overlap Check
   * Prevent articles with same primary or overlapping supporting keywords
   */
  async checkKeywordOverlap(primaryKeyword, supportingKeywords = []) {
    await this.initializeRegister();
    
    const normalizedPrimary = this.normalize(primaryKeyword);
    
    for (const article of this.register) {
      // Check primary keyword exact match
      if (this.normalize(article.primaryKeyword) === normalizedPrimary) {
        return {
          isDuplicate: true,
          conflictingArticle: article.title,
          conflictType: 'PRIMARY_KEYWORD_MATCH',
          layer: 'KEYWORD_OVERLAP'
        };
      }

      // Check if primary keyword is in other article's supporting keywords
      const existingSupporting = (article.supportingKeywords || '').split(';').map(k => this.normalize(k.trim()));
      if (existingSupporting.includes(normalizedPrimary)) {
        return {
          isDuplicate: true,
          conflictingArticle: article.title,
          conflictType: 'PRIMARY_IN_SUPPORTING',
          layer: 'KEYWORD_OVERLAP'
        };
      }

      // Check supporting keyword overlap (30%+ overlap)
      const newSupporting = supportingKeywords.map(k => this.normalize(k));
      const overlapCount = newSupporting.filter(k => existingSupporting.includes(k)).length;
      const overlapRatio = newSupporting.length > 0 ? overlapCount / newSupporting.length : 0;

      if (overlapRatio >= 0.3 && newSupporting.length > 0) {
        return {
          isDuplicate: true,
          conflictingArticle: article.title,
          conflictType: 'SUPPORTING_KEYWORD_OVERLAP',
          overlapPercentage: Math.round(overlapRatio * 100),
          layer: 'KEYWORD_OVERLAP'
        };
      }
    }

    return {
      isDuplicate: false,
      layer: 'KEYWORD_OVERLAP'
    };
  }

  /**
   * Layer 4: URL Slug Uniqueness Check
   * Ensure unique URL slugs
   */
  async checkSlugUniqueness(slug) {
    await this.initializeRegister();
    
    const normalizedSlug = this.normalize(slug);
    const match = this.register.find(
      a => this.normalize(a.slug || '') === normalizedSlug
    );

    return {
      isDuplicate: !!match,
      existingUrl: match ? match.url : null,
      layer: 'SLUG_UNIQUENESS'
    };
  }

  /**
   * Layer 5: Topic Category Saturation
   * Prevent too many articles on the same topic (max 2 per topic)
   */
  async checkTopicSaturation(topicCategory, maxPerCategory = 2) {
    await this.initializeRegister();
    
    const count = this.register.filter(
      a => this.normalize(a.topicCategory) === this.normalize(topicCategory)
    ).length;

    return {
      isSaturated: count >= maxPerCategory,
      articlesInCategory: count,
      maxAllowed: maxPerCategory,
      layer: 'TOPIC_SATURATION'
    };
  }

  /**
   * MASTER FUNCTION: Run all duplicate checks
   * Returns comprehensive report
   */
  async runFullDuplicateCheck(article, options = {}) {
    const {
      semanticThreshold = 0.85,
      maxPerCategory = 2,
      failOnSaturation = false
    } = options;

    const results = {
      isApproved: true,
      checks: [],
      errors: [],
      warnings: []
    };

    // Check 1: Exact Title
    const titleCheck = await this.checkExactTitle(article.h1);
    results.checks.push(titleCheck);
    if (titleCheck.isDuplicate) {
      results.isApproved = false;
      results.errors.push(`DUPLICATE TITLE: "${article.h1}" already published as "${titleCheck.existingTitle}"`);
    }

    // Check 2: Semantic Similarity
    const semanticCheck = await this.checkSemanticSimilarity(article.h1, semanticThreshold);
    results.checks.push(semanticCheck);
    if (semanticCheck.isDuplicate) {
      results.isApproved = false;
      results.errors.push(`SIMILAR CONTENT (${semanticCheck.similarity}%): "${article.h1}" conflicts with "${semanticCheck.similarArticle}"`);
    }

    // Check 3: Keyword Overlap
    const keywordCheck = await this.checkKeywordOverlap(
      article.primaryKeyword,
      article.supportingKeywords || []
    );
    results.checks.push(keywordCheck);
    if (keywordCheck.isDuplicate) {
      results.isApproved = false;
      results.errors.push(`KEYWORD CONFLICT: ${keywordCheck.conflictType} with "${keywordCheck.conflictingArticle}"`);
    }

    // Check 4: Slug Uniqueness
    const slugCheck = await this.checkSlugUniqueness(article.slug);
    results.checks.push(slugCheck);
    if (slugCheck.isDuplicate) {
      results.isApproved = false;
      results.errors.push(`DUPLICATE SLUG: "${article.slug}" already used at ${slugCheck.existingUrl}`);
    }

    // Check 5: Topic Saturation
    const saturationCheck = await this.checkTopicSaturation(article.topicCategory, maxPerCategory);
    results.checks.push(saturationCheck);
    if (saturationCheck.isSaturated) {
      const msg = `TOPIC SATURATED: ${saturationCheck.articlesInCategory} articles already on "${article.topicCategory}" (max: ${maxPerCategory})`;
      if (failOnSaturation) {
        results.isApproved = false;
        results.errors.push(msg);
      } else {
        results.warnings.push(msg);
      }
    }

    return results;
  }

  /**
   * Normalize text for comparison
   */
  normalize(text) {
    return String(text || '')
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ');
  }

  /**
   * Calculate text similarity using Levenshtein distance
   * Returns value between 0 and 1 (1 = identical)
   */
  calculateSimilarity(str1, str2) {
    const s1 = this.normalize(str1);
    const s2 = this.normalize(str2);

    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.getLevenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  getLevenshteinDistance(s1, s2) {
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }

  /**
   * Format results for logging
   */
  formatResults(results) {
    let output = '';
    
    if (results.isApproved) {
      output += '✅ APPROVED: Article is unique and safe to publish\n\n';
    } else {
      output += '❌ REJECTED: Duplicate or conflicting article detected\n\n';
    }

    output += 'Checks performed:\n';
    for (const check of results.checks) {
      const status = check.isDuplicate ? '❌' : '✅';
      output += `${status} ${check.layer}\n`;
      if (check.isDuplicate) {
        output += `   Details: ${JSON.stringify(check, null, 2)}\n`;
      }
    }

    if (results.errors.length > 0) {
      output += '\n❌ Errors:\n';
      results.errors.forEach(e => output += `   - ${e}\n`);
    }

    if (results.warnings.length > 0) {
      output += '\n⚠️  Warnings:\n';
      results.warnings.forEach(w => output += `   - ${w}\n`);
    }

    return output;
  }
}

module.exports = { DuplicateChecker };
