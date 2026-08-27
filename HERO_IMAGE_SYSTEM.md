# Hero Image Generation & Branding System

## Vision
Automatically generate professional, on-brand hero images for every blog post that:
- Match your ColourDiam branding (colors, fonts, style)
- Include relevant diamond/jewellery imagery
- Have proper dimensions for your blog (1600x900 JPG)
- Include alt text and image metadata
- Upload alongside blog content

---

## Phase 1: Brand Guidelines

### 1.1 ColourDiam Brand Colors
```javascript
// src/branding.js
const BRAND_COLORS = {
  primary: '#1a1a2e',        // Dark Navy (luxury base)
  secondary: '#d4af37',      // Gold (premium accent)
  accent: '#e8d9c3',         // Cream/Light beige
  text: '#ffffff',           // White text
  darkText: '#1a1a2e',       // Dark text for light backgrounds
  diamond: '#f5f5f5',        // Diamond shine/reflection
  rose: '#c4786d',           // Rose gold option
};

const TYPOGRAPHY = {
  headingFont: 'Georgia',    // Elegant, luxury serif
  bodyFont: 'Calibri',       // Clean, professional
  fontSize: {
    h1: 48,
    h2: 36,
    body: 16
  }
};

const BRAND_STYLE = {
  theme: 'luxury-minimal',
  border: 'elegant-gold-accent',
  overlay: 'semi-transparent-gradient',
  cornerStyle: 'subtle-ornamental'
};
```

### 1.2 Image Templates
```javascript
const HERO_TEMPLATES = {
  // Template 1: Full diamond imagery with overlay text
  diamondShowcase: {
    background: 'professional-diamond-image',
    overlay: 'gold-gradient-70%',
    layout: 'text-overlay-bottom-right',
    logoPlacement: 'top-left',
  },
  
  // Template 2: Split design - text on left, diamond on right
  splitDesign: {
    leftSide: 'brand-color-solid',
    rightSide: 'diamond-image',
    textPlacement: 'left-center',
    divider: 'gold-line'
  },
  
  // Template 3: Minimalist - subtle background with bold text
  minimalist: {
    background: 'cream-color-with-subtle-texture',
    elements: 'small-gold-accents',
    textPlacement: 'center',
    emphasis: 'typography'
  },
  
  // Template 4: Product-focused - jewelry showcase
  productFocus: {
    background: 'luxury-blurred-diamond-texture',
    product: 'center-staged-jewelry',
    lighting: 'professional-gem-lighting',
    reflection: 'subtle-glass-effect'
  }
};
```

---

## Phase 2: Dynamic Hero Image Generation

### 2.1 AI-Powered Image Generation via Prompt

```javascript
// src/hero-image-generator.js
const Jimp = require('jimp');  // or use canvas + node-canvas
const fetch = require('node-fetch');

class HeroImageGenerator {
  constructor(brandConfig) {
    this.brand = brandConfig;
  }

  /**
   * Generate image description prompt for AI image generation
   */
  generateImagePrompt(article) {
    const { h1, primaryKeyword, topicCategory } = article;
    
    const prompts = {
      'Diamonds': `Professional luxury photo of a ${primaryKeyword} diamond, 
        expertly lit with professional gem photography lighting, 
        on dark navy background with gold accents, 
        high-resolution, studio quality, premium jewelry photography`,
      
      'Jewellery': `Elegant luxury jewelry featuring ${primaryKeyword}, 
        photographed on luxury surface with soft lighting, 
        navy and gold color scheme, professional gem photography, 
        showcase style`,
      
      'Education': `Sophisticated infographic-style image about ${primaryKeyword}, 
        navy background with gold accents, 
        clean professional design, educational, luxury feel`,
      
      'Buying Guide': `Professional luxury lifestyle photo related to ${primaryKeyword}, 
        navy and gold color scheme, 
        upscale jewelry store aesthetic, professional photography`,
      
      'Trends': `Modern luxury diamond and jewelry trend photo for "${h1}", 
        contemporary professional styling, 
        navy and cream color palette with gold highlights`
    };

    return prompts[topicCategory] || prompts['Diamonds'];
  }

  /**
   * Use external AI image API to generate image
   * Options: Stable Diffusion, DALL-E, Replicate, etc.
   */
  async generateImageViaAPI(article, apiProvider = 'replicate') {
    const prompt = this.generateImagePrompt(article);
    
    if (apiProvider === 'replicate') {
      return this.generateViaReplicate(prompt, article);
    } else if (apiProvider === 'stability') {
      return this.generateViaStabilityAI(prompt, article);
    } else if (apiProvider === 'openai') {
      return this.generateViaDallE(prompt, article);
    }
  }

  /**
   * Generate via Replicate (Stable Diffusion)
   */
  async generateViaReplicate(prompt, article) {
    const Replicate = require('replicate');
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    const output = await replicate.run(
      'stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21aef33d3e3b7e9126',
      {
        input: {
          prompt: prompt,
          negative_prompt: 'blurry, low quality, watermark, text',
          num_outputs: 1,
          num_inference_steps: 50,
          guidance_scale: 7.5,
          width: 1600,
          height: 900,
        }
      }
    );

    return {
      imageUrl: output[0],
      provider: 'replicate',
      prompt: prompt,
      article: article.h1
    };
  }

  /**
   * Generate via DALL-E 3
   */
  async generateViaDallE(prompt, article) {
    const OpenAI = require('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1792x1024', // DALL-E 3 closest to 1600x900
      quality: 'hd',
      style: 'natural'
    });

    return {
      imageUrl: response.data[0].url,
      provider: 'dall-e-3',
      prompt: prompt,
      article: article.h1
    };
  }

  /**
   * Generate via Stability AI API
   */
  async generateViaStabilityAI(prompt, article) {
    const form = new FormData();
    form.append('prompt', prompt);
    form.append('output_format', 'jpeg');
    form.append('aspect_ratio', '16:9');
    form.append('model', 'sd3-large');

    const response = await fetch(
      'https://api.stability.ai/v2beta/stable-image/generate/sd3',
      {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${process.env.STABILITY_API_KEY}`,
        },
        body: form,
      }
    );

    if (!response.ok) {
      throw new Error(`Stability AI error: ${response.status}`);
    }

    const imageBuffer = await response.buffer();
    return {
      imageBuffer: imageBuffer,
      provider: 'stability-ai',
      prompt: prompt,
      article: article.h1
    };
  }
}

module.exports = { HeroImageGenerator };
```

### 2.2 Local Image Generation with Overlay

```javascript
/**
 * Add text overlay + branding to generated image
 */
async function addBrandingOverlay(imageInput, article, brand) {
  const image = await Jimp.read(imageInput);
  
  // Ensure image is 1600x900
  image.resize(1600, 900);

  // Add semi-transparent gold gradient overlay
  const gradientOverlay = new Jimp(1600, 900, brand.primary);
  
  // Create gradient effect
  for (let y = 0; y < 900; y++) {
    const opacity = Math.floor(200 - (y / 900) * 150); // Darker at bottom
    for (let x = 0; x < 1600; x++) {
      // Add slight transparency
      gradientOverlay.setPixelColor(
        Jimp.rgbaToInt(212, 175, 55, 100),
        x,
        y
      );
    }
  }

  // Composite overlay on top of image
  image.composite(gradientOverlay, 0, 0);

  // Add ColourDiam logo (top-left)
  const logo = await Jimp.read('./assets/logo.png');
  logo.resize(120, 40);
  image.composite(logo, 30, 30);

  // Add article title as text overlay
  const font = await Jimp.loadFont(Jimp.FONT_SANS_64_BLACK);
  const title = article.h1.substring(0, 50) + (article.h1.length > 50 ? '...' : '');
  
  image.print(
    font,
    50,
    700,
    title,
    1450,  // Max width
    {
      alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
      alignmentY: Jimp.VERTICAL_ALIGN_TOP
    }
  );

  // Add primary keyword highlight
  image.print(
    font,
    50,
    820,
    article.primaryKeyword,
    1450,
    {
      alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
      alignmentY: Jimp.VERTICAL_ALIGN_TOP,
      color: Jimp.cssColorToHex('#d4af37') // Gold
    }
  );

  // Add subtle "colourdiam.com" watermark
  image.print(
    Jimp.FONT_SANS_16_BLACK,
    1400,
    850,
    'www.colourdiam.com',
    150
  );

  return image;
}
```

---

## Phase 3: Integration with Blog Upload

### 3.1 Updated Upload Workflow

```javascript
// Updated in index.js
async function runLlmCycle() {
  const existingTitles = await loadRegisterTitles();
  const articles = [];
  
  for (let i = 0; i < config.articlesPerRun; i++) {
    try {
      const topic = await nextTopic(existingTitles);
      console.log(`📝 Generating article for topic: "${topic}"`);
      
      // 1. Generate article content
      const article = await generateArticle(topic, existingTitles);
      const { filePath, safeSlug, imageFilename } = saveArticle(article);
      console.log(`✅ Saved: ${filePath}`);

      // 2. GENERATE HERO IMAGE with branding
      let heroImagePath = null;
      try {
        console.log(`🎨 Generating hero image for "${article.h1}"...`);
        
        // Option A: AI-generated image with branding
        if (config.enableAIImageGeneration) {
          const generator = new HeroImageGenerator(BRAND_COLORS);
          const generatedImage = await generator.generateImageViaAPI(
            article,
            config.imageProvider // 'replicate', 'dall-e', 'stability'
          );
          
          // Download the generated image
          const imageBuffer = await downloadImage(generatedImage.imageUrl);
          
          // Add branding overlay
          const brandedImage = await addBrandingOverlay(
            imageBuffer,
            article,
            BRAND_COLORS
          );
          
          heroImagePath = path.join(CONTENT_DIR, imageFilename);
          await brandedImage.write(heroImagePath);
          console.log(`🎨 Hero image generated with branding: ${imageFilename}`);
        }
        // Option B: Use template-based image
        else if (config.enableTemplateImages) {
          const templateImage = await generateTemplateImage(article, HERO_TEMPLATES);
          heroImagePath = path.join(CONTENT_DIR, imageFilename);
          await templateImage.write(heroImagePath);
          console.log(`🎨 Template image generated: ${imageFilename}`);
        }
        
        article.imagePath = heroImagePath;
      } catch (err) {
        console.error(`⚠️  Hero image generation failed for "${article.h1}": ${err.message}`);
        // Continue without image - can be added manually
      }

      // 3. Register article
      await addRegisterEntry({
        PublicationDate: new Date().toISOString().slice(0, 10),
        ArticleTitle: article.h1,
        URL: `https://www.colourdiam.com/blog/${safeSlug}`,
        PrimaryKeyword: article.primaryKeyword,
        SupportingKeywords: (article.supportingKeywords || []).join('; '),
        SearchIntent: article.searchIntent,
        TopicCategory: article.topicCategory,
        InternalPagesLinked: (article.internalPagesLinked || []).join('; '),
        PublishingStatus: 'Draft',
        PerformanceResults: '',
      });
      
      articles.push(article);
      existingTitles.push(article.h1);
    } catch (err) {
      console.error(`❌ Article generation failed: ${err.message}`);
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
        imagePath: article.imagePath,  // ← Hero image uploaded here
        imageAlt: article.imageAlt,    // ← Alt text for SEO
        imageCaption: article.imageCaption,
      };
      
      try {
        console.log(`⬆️  Uploading "${article.h1}" with hero image...`);
        await uploader.uploadPost(post);
        console.log(`✅ Published: "${article.h1}"`);
      } catch (err) {
        console.error(`❌ Failed to upload "${article.h1}": ${err.message}`);
      }
    }
  } finally {
    await uploader.close();
  }
}
```

### 3.2 Updated Uploader for Image Handling

```javascript
// Updated uploader.js
async function _setImage(imagePath) {
  if (!imagePath) {
    console.warn('⚠️  No hero image provided');
    return;
  }

  try {
    const fs = require('fs');
    
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    // Read image file
    const imageBuffer = fs.readFileSync(imagePath);
    const b64 = imageBuffer.toString('base64');
    const mime = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

    // Set image in admin form
    await this.page.fill('#file', `data:${mime};base64,${b64}`);
    
    // Wait for image preview to load
    await this.page.waitForTimeout(1000);
    
    console.log(`✅ Image uploaded: ${path.basename(imagePath)}`);
  } catch (err) {
    console.error(`❌ Image upload failed: ${err.message}`);
    throw err;
  }
}

async function uploadPost(post) {
  if (this.page.url() !== this.config.admin.blogUrl) {
    await this.openBlogPage();
  }

  console.log(`📝 Setting title: "${post.title}"`);
  await this._setSubject(post.title);
  
  console.log(`📄 Setting content...`);
  await this._setBody(post.content);
  
  console.log(`🖼️  Setting hero image...`);
  if (post.imagePath) {
    await this._setImage(post.imagePath);
  }
  
  // If your CMS supports it, also set alt text and caption
  if (post.imageAlt) {
    try {
      await this.page.fill('#imageAlt', post.imageAlt);
      await this.page.fill('#imageCaption', post.imageCaption || '');
    } catch (e) {
      console.warn('⚠️  Could not set image alt/caption (not in form)');
    }
  }
  
  console.log(`💾 Saving blog post...`);
  await this.page.click('#btnSave');
  await this.page.waitForTimeout(3000);
  
  const success = await this.page.evaluate(() => {
    const el = document.querySelector('.alert-success, .notify-success, #successMsg');
    return el ? el.innerText.trim() : '';
  });
  
  const url = this.page.url();
  console.log(`✅ Published: "${post.title}" at ${url}`);
  return success;
}
```

---

## Phase 4: Configuration

### 4.1 Enhanced .env

```env
# Hero Image Generation
ENABLE_AI_IMAGE_GENERATION=true
IMAGE_PROVIDER=replicate          # Options: replicate, dall-e, stability
REPLICATE_API_TOKEN=your_token
OPENAI_API_KEY=your_key
STABILITY_API_KEY=your_key

# Template-based images (fallback)
ENABLE_TEMPLATE_IMAGES=false
HERO_IMAGE_QUALITY=high            # Options: low, medium, high

# Branding
BRAND_LOGO_PATH=./assets/logo.png
BRAND_PRIMARY_COLOR=#1a1a2e
BRAND_SECONDARY_COLOR=#d4af37
BRAND_ACCENT_COLOR=#e8d9c3

# Image Settings
HERO_IMAGE_WIDTH=1600
HERO_IMAGE_HEIGHT=900
HERO_IMAGE_FORMAT=jpeg
ADD_WATERMARK=true
WATERMARK_TEXT=www.colourdiam.com

# Upload
UPLOAD_HERO_IMAGE=true
SET_IMAGE_ALT_TEXT=true
SET_IMAGE_CAPTION=true
```

---

## Phase 5: Image Specifications

### 5.1 Hero Image Requirements

```
Format:          JPG (high quality)
Dimensions:      1600 x 900 pixels
Aspect Ratio:    16:9
Quality:         High (90-95% compression)
File Size:       ~300-500 KB (optimized)
Color Space:     sRGB
DPI:             72 (web standard)
```

### 5.2 Image Metadata

```javascript
// Every image gets:
{
  filename: "seo-filename.jpg",
  alt: "Pink diamond engagement ring with 18k gold setting",
  caption: "Professional diamond photography",
  title: "Article Title",
  description: "SEO description",
  keywords: ["pink diamond", "engagement ring", "luxury jewellery"]
}
```

---

## Phase 6: Quality Assurance

### 6.1 Image Validation

```javascript
async function validateHeroImage(imagePath, article) {
  const image = await Jimp.read(imagePath);
  
  // Check dimensions
  if (image.getWidth() !== 1600 || image.getHeight() !== 900) {
    throw new Error(`Invalid dimensions: ${image.getWidth()}x${image.getHeight()}`);
  }
  
  // Check file size
  const stats = fs.statSync(imagePath);
  if (stats.size > 1000000) {
    throw new Error(`File too large: ${stats.size} bytes`);
  }
  
  // Check image has visible content (not pure white/black)
  const histogram = image.getHistogram();
  if (histogram.r.every(v => v === 0) || histogram.r.every(v => v === 255)) {
    throw new Error('Image appears blank or invalid');
  }
  
  console.log(`✅ Image validation passed: ${path.basename(imagePath)}`);
}
```

---

## Dependencies to Install

```bash
npm install jimp           # Image manipulation
npm install replicate      # AI image generation
npm install openai         # DALL-E 3
npm install node-fetch     # For API calls
npm install sharp          # Fast image processing (alternative)
```

---

## Example Workflow

```
1. Generate Article
   ↓
2. Create AI Image Prompt (based on article topic)
   ↓
3. Generate Image via API (1-2 minutes)
   ↓
4. Add Brand Overlay
   - ColourDiam logo (top-left)
   - Article title
   - Primary keyword (in gold)
   - Watermark
   ↓
5. Validate Image
   - Check dimensions (1600x900)
   - Check file size
   - Verify content quality
   ↓
6. Upload to Blog
   - Image file
   - Alt text
   - Caption
   ↓
7. Mark as Published
   - Register article with image metadata
```

---

## Success Metrics

✅ Every blog post has a professional, branded hero image  
✅ Images are consistent with ColourDiam brand guidelines  
✅ All images are properly optimized (1600x900, <500KB)  
✅ Alt text improves SEO  
✅ Images increase click-through rate from search results  
✅ Brand recognition strengthened through visual consistency  

---

**Status**: Ready for Implementation  
**Priority**: High - Essential for Professional Blog Appearance
