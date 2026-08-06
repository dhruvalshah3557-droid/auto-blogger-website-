const fs = require('fs');
const path = require('path');
const { chatCompletion } = require('./llm');

const CONTENT_DIR = path.join(__dirname, '..', 'content');

const SYSTEM_PROMPT = `You are the SEO Content Director for ColourDiam, an international specialist in natural fancy-colour diamonds and fine diamond jewellery (https://www.colourdiam.com).

Your primary objective: create accurate, original, customer-focused blog articles that improve ColourDiam's organic search visibility, demonstrate expertise, and guide readers naturally toward relevant ColourDiam pages.

CONTENT RULES
- Write only original articles, 1200-1800 words, in polished professional English.
- Confident, knowledgeable, elegant, trustworthy tone. Short paragraphs, descriptive headings.
- Explain technical terms in plain language. Never copy or paraphrase another website.
- Never invent trends, statistics, product details, certifications, prices, availability, company claims, or customer stories.
- Never claim guaranteed appreciation, profit, rarity, origin, or value without reliable evidence.
- Distinguish natural diamonds from laboratory-grown or treated diamonds whenever relevant.
- Use "jewellery" as the default spelling.
- Include a helpful, non-pushy call to action.
- Include a brief informational disclaimer when discussing value, investment, insurance, or legal considerations.
- Avoid repetition, filler, keyword stuffing, clichés, and exaggerated luxury language.

INTERNAL LINKS
- Link naturally to 3-5 relevant ColourDiam pages. Use ONLY these verified URLs:
  Home: https://www.colourdiam.com/
  Diamonds: https://www.colourdiam.com/diamonds
  Jewellery: https://www.colourdiam.com/product
  Education: https://www.colourdiam.com/education
  About: https://www.colourdiam.com/aboutus
  Blog: https://www.colourdiam.com/blog
  Contact: https://www.colourdiam.com/contactus
- Use descriptive anchor text, not "click here". Do not cluster links in one paragraph.
- Do not force irrelevant links. Never invent a URL.

IMAGE
- Every article needs a professional hero image placeholder. Provide a detailed image-generation brief, filename (always ending in .jpg), alt text (8-15 words), and caption.
- Images are always delivered in JPG format, landscape 1600x900.

OUTPUT FORMAT
Return ONLY valid JSON with this exact structure:
{
  "seoTitle": "50-60 chars",
  "metaDescription": "145-160 chars",
  "slug": "kebab-case-slug",
  "excerpt": "one sentence for the blog listing",
  "primaryKeyword": "one keyword",
  "supportingKeywords": ["3-6 keywords"],
  "searchIntent": "Informational / Commercial / etc",
  "topicCategory": "category name",
  "internalPagesLinked": ["/diamonds", "/education", ...],
  "h1": "single H1 containing primary keyword where natural",
  "articleHtml": "full article as HTML with <h2>/<h3> headings, short paragraphs, natural internal links, conclusion, call to action, and investment/value disclaimer where relevant",
  "imageBrief": "detailed professional image-generation or photography brief",
  "imageFilename": "seo-filename.webp",
  "imageAlt": "alt text 8-15 words",
  "imageCaption": "short caption",
  "faq": [
    {"q": "question", "a": "concise answer"}
  ],
  "faqJsonLd": "valid FAQPage JSON-LD as a JSON string",
  "articleJsonLd": "valid Article JSON-LD as a JSON string"
}`;

async function generateArticle(topic, existingTitles) {
  const userPrompt = `Topic: "${topic}"

Previously published ColourDiam articles (duplication check - do NOT repeat these topics, structures, or central arguments):
${existingTitles.join('\n')}

Produce the complete article package as specified. If the topic would duplicate an existing article, instead choose the closest fresh topic from the same area and note it in the excerpt.`;

  let raw = await chatCompletion({
    system: SYSTEM_PROMPT,
    user: userPrompt,
    temperature: 0.7,
    maxTokens: 6000,
  });

  raw = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(raw);
  parsed.topic = topic;

  const meta = {
    seoTitle: parsed.seoTitle || '',
    metaDescription: parsed.metaDescription || '',
    slug: parsed.slug || 'untitled',
    excerpt: parsed.excerpt || '',
    primaryKeyword: parsed.primaryKeyword || '',
    supportingKeywords: parsed.supportingKeywords || [],
    searchIntent: parsed.searchIntent || '',
    topicCategory: parsed.topicCategory || '',
    internalPagesLinked: parsed.internalPagesLinked || [],
    h1: parsed.h1 || topic,
    articleHtml: parsed.articleHtml || '',
    imageBrief: parsed.imageBrief || '',
    imageFilename: parsed.imageFilename || '',
    imageAlt: parsed.imageAlt || '',
    imageCaption: parsed.imageCaption || '',
    faq: parsed.faq || [],
    faqJsonLd: parsed.faqJsonLd || '',
    articleJsonLd: parsed.articleJsonLd || '',
  };

  if (!meta.articleHtml) {
    throw new Error(`LLM returned an article with no body for topic: ${topic}`);
  }
  return meta;
}

function ensureJpg(filename) {
  return String(filename || 'hero').replace(/\.(png|webp|jpe?g|svg)$/i, '') + '.jpg';
}

function saveArticle(meta) {
  const safeSlug = meta.slug || meta.h1.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const filePath = path.join(CONTENT_DIR, `${safeSlug}.md`);
  const imageFilename = ensureJpg(meta.imageFilename);
  const md = `# ${meta.h1}

**SEO title:** ${meta.seoTitle}
**Meta description:** ${meta.metaDescription}
**Slug:** ${meta.slug}
**Excerpt:** ${meta.excerpt}
**Primary keyword:** ${meta.primaryKeyword}
**Supporting keywords:** ${(meta.supportingKeywords || []).join(', ')}
**Search intent:** ${meta.searchIntent}
**Topic category:** ${meta.topicCategory}
**Internal pages linked:** ${(meta.internalPagesLinked || []).join(', ')}

---

## Article

${htmlToMarkdown(meta.articleHtml)}

---

## FAQ

${(meta.faq || []).map((f) => `### ${f.q}\n\n${f.a}`).join('\n\n')}

---

## Structured Data

\`\`\`json
${meta.faqJsonLd}
\`\`\`

\`\`\`json
${meta.articleJsonLd}
\`\`\`

---

## Image Package

- **Brief:** ${meta.imageBrief}
- **Filename:** ${imageFilename}
- **Alt text:** ${meta.imageAlt}
- **Caption:** ${meta.imageCaption}
- **Format:** JPG, landscape 1600x900

[PROFESSIONAL HERO IMAGE REQUIRED - DO NOT PUBLISH WITHOUT IMAGE]
`;
  fs.writeFileSync(filePath, md);
  return { filePath, safeSlug, imageFilename };
}

async function generateHeroImage(title, filename, outDir = CONTENT_DIR) {
  const { execFile } = require('child_process');
  const outPath = path.join(outDir, ensureJpg(filename));
  const rubyScript = path.join(__dirname, '..', 'scripts', 'hero_image.rb');
  await new Promise((resolve, reject) => {
    execFile('ruby', [rubyScript, title, outPath], (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`Hero image generation failed: ${stderr || err.message}`));
      } else {
        resolve(stdout);
      }
    });
  });
  return outPath;
}

function htmlToMarkdown(html) {
  let s = String(html || '');
  s = s.replace(/<h1[^>]*>/gi, '# ').replace(/<\/h1>/gi, '\n\n');
  s = s.replace(/<h2[^>]*>/gi, '## ').replace(/<\/h2>/gi, '\n\n');
  s = s.replace(/<h3[^>]*>/gi, '### ').replace(/<\/h3>/gi, '\n\n');
  s = s.replace(/<h4[^>]*>/gi, '#### ').replace(/<\/h4>/gi, '\n\n');
  s = s.replace(/<p[^>]*>/gi, '').replace(/<\/p>/gi, '\n\n');
  s = s.replace(/<li[^>]*>/gi, '- ').replace(/<\/li>/gi, '\n');
  s = s.replace(/<ul[^>]*>/gi, '').replace(/<\/ul>/gi, '\n');
  s = s.replace(/<ol[^>]*>/gi, '').replace(/<\/ol>/gi, '\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<strong[^>]*>/gi, '**').replace(/<\/strong>/gi, '**');
  s = s.replace(/<em[^>]*>/gi, '*').replace(/<\/em>/gi, '*');
  s = s.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/[ \t]+\n/g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

module.exports = { generateArticle, saveArticle, generateHeroImage, ensureJpg, SYSTEM_PROMPT };
