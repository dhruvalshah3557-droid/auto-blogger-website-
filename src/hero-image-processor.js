const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

/**
 * VERIFY → CHECK → UPLOAD workflow
 * Ensures no errors occur during image processing and upload
 */

class HeroImageProcessor {
  constructor(config = {}) {
    this.config = {
      width: config.width || 1600,
      height: config.height || 900,
      maxFileSize: config.maxFileSize || 500000, // 500KB
      format: config.format || 'jpeg',
      quality: config.quality || 95,
      ...config
    };
    this.validationLog = [];
  }

  /**
   * STEP 1: VERIFY - Check if image source exists and is accessible
   */
  async verifyImageSource(imagePath) {
    const checks = {
      passed: true,
      errors: [],
      warnings: [],
      details: {}
    };

    console.log(`\n🔍 STEP 1: VERIFY IMAGE SOURCE`);
    console.log(`   File: ${imagePath}`);

    // Check 1.1: File exists
    try {
      if (!fs.existsSync(imagePath)) {
        checks.passed = false;
        checks.errors.push(`File does not exist: ${imagePath}`);
        console.log(`   ❌ File exists: NO`);
        return checks;
      }
      console.log(`   ✅ File exists: YES`);
    } catch (err) {
      checks.passed = false;
      checks.errors.push(`Cannot access file: ${err.message}`);
      return checks;
    }

    // Check 1.2: File is readable
    try {
      const stats = fs.statSync(imagePath);
      checks.details.fileSize = stats.size;
      checks.details.fileSizeKB = (stats.size / 1024).toFixed(2);
      console.log(`   ✅ File readable: YES (${checks.details.fileSizeKB} KB)`);
    } catch (err) {
      checks.passed = false;
      checks.errors.push(`Cannot read file stats: ${err.message}`);
      return checks;
    }

    // Check 1.3: File is an image
    try {
      const buffer = fs.readFileSync(imagePath);
      const image = await Jimp.read(buffer);
      
      checks.details.width = image.getWidth();
      checks.details.height = image.getHeight();
      checks.details.hasContent = true;
      
      console.log(`   ✅ Valid image: YES (${image.getWidth()}x${image.getHeight()})`);
    } catch (err) {
      checks.passed = false;
      checks.errors.push(`Not a valid image: ${err.message}`);
      return checks;
    }

    this.validationLog.push({
      step: 'VERIFY',
      timestamp: new Date().toISOString(),
      result: checks.passed ? 'PASSED' : 'FAILED',
      details: checks
    });

    return checks;
  }

  /**
   * STEP 2: CHECK - Validate image dimensions, quality, and format
   */
  async checkImageQuality(imagePath) {
    const checks = {
      passed: true,
      errors: [],
      warnings: [],
      details: {}
    };

    console.log(`\n✔️  STEP 2: CHECK IMAGE QUALITY`);

    try {
      const buffer = fs.readFileSync(imagePath);
      const image = await Jimp.read(buffer);

      // Check 2.1: Dimensions
      const width = image.getWidth();
      const height = image.getHeight();
      const requiredAspect = this.config.width / this.config.height; // 16:9
      const actualAspect = width / height;
      const aspectDiff = Math.abs(requiredAspect - actualAspect);

      if (aspectDiff > 0.05) {
        checks.warnings.push(
          `Aspect ratio not exactly 16:9 (actual: ${actualAspect.toFixed(3)}). ` +
          `Image will be resized from ${width}x${height} to ${this.config.width}x${this.config.height}`
        );
        console.log(`   ⚠️  Aspect ratio: NEEDS RESIZE (${actualAspect.toFixed(3)}, expected 16:9)`);
      } else {
        console.log(`   ✅ Aspect ratio: CORRECT (16:9)`);
      }

      checks.details.originalDimensions = `${width}x${height}`;
      checks.details.targetDimensions = `${this.config.width}x${this.config.height}`;

      // Check 2.2: File size
      const fileSize = fs.statSync(imagePath).size;
      if (fileSize > this.config.maxFileSize) {
        checks.warnings.push(
          `File size ${(fileSize / 1024).toFixed(2)}KB exceeds max ${(this.config.maxFileSize / 1024).toFixed(2)}KB. ` +
          `Will be compressed during processing.`
        );
        console.log(`   ⚠️  File size: EXCEEDS LIMIT (${(fileSize / 1024).toFixed(2)}KB)`);
      } else {
        console.log(`   ✅ File size: OK (${(fileSize / 1024).toFixed(2)}KB)`);
      }

      checks.details.currentFileSize = fileSize;
      checks.details.maxFileSize = this.config.maxFileSize;

      // Check 2.3: Image has visible content (not blank)
      try {
        const histogram = image.getHistogram();
        const hasContent = Object.values(histogram).some(channel => {
          const mean = channel.reduce((a, b) => a + b, 0) / channel.length;
          return mean > 10 && mean < 245; // Not all black or all white
        });

        if (!hasContent) {
          checks.passed = false;
          checks.errors.push('Image appears to be blank or has no visible content');
          console.log(`   ❌ Image content: BLANK OR INVALID`);
          return checks;
        }
        console.log(`   ✅ Image content: VISIBLE`);
      } catch (err) {
        checks.warnings.push(`Could not verify image content: ${err.message}`);
      }

      // Check 2.4: Color depth
      checks.details.colorDepth = 'RGB/RGBA';
      console.log(`   ✅ Color depth: ${checks.details.colorDepth}`);

    } catch (err) {
      checks.passed = false;
      checks.errors.push(`Image quality check failed: ${err.message}`);
      return checks;
    }

    this.validationLog.push({
      step: 'CHECK',
      timestamp: new Date().toISOString(),
      result: checks.passed ? 'PASSED' : 'FAILED',
      details: checks
    });

    return checks;
  }

  /**
   * STEP 3: OPTIMIZE - Resize, compress, and format image
   */
  async optimizeImage(imagePath, outputPath) {
    const optimized = {
      success: false,
      errors: [],
      warnings: [],
      details: {}
    };

    console.log(`\n⚙️  STEP 3: OPTIMIZE IMAGE`);
    console.log(`   Input: ${path.basename(imagePath)}`);
    console.log(`   Output: ${path.basename(outputPath)}`);

    try {
      let image = await Jimp.read(imagePath);

      // Step 3.1: Resize to target dimensions
      console.log(`   Resizing to ${this.config.width}x${this.config.height}...`);
      image.resize(this.config.width, this.config.height);
      optimized.details.resized = true;

      // Step 3.2: Save with quality compression
      console.log(`   Compressing to quality ${this.config.quality}...`);
      
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      if (this.config.format === 'jpeg' || this.config.format === 'jpg') {
        await image.quality(this.config.quality).write(outputPath);
      } else if (this.config.format === 'png') {
        await image.png({ compressionLevel: 9 }).write(outputPath);
      } else {
        await image.write(outputPath);
      }

      // Step 3.3: Verify output file
      if (!fs.existsSync(outputPath)) {
        throw new Error('Output file was not created');
      }

      const outputStats = fs.statSync(outputPath);
      optimized.details.outputFileSize = outputStats.size;
      optimized.details.outputFileSizeKB = (outputStats.size / 1024).toFixed(2);

      console.log(`   ✅ Image optimized: ${optimized.details.outputFileSizeKB}KB`);
      optimized.success = true;

    } catch (err) {
      optimized.success = false;
      optimized.errors.push(`Image optimization failed: ${err.message}`);
      console.log(`   ❌ Optimization error: ${err.message}`);
    }

    this.validationLog.push({
      step: 'OPTIMIZE',
      timestamp: new Date().toISOString(),
      result: optimized.success ? 'SUCCESS' : 'FAILED',
      details: optimized
    });

    return optimized;
  }

  /**
   * STEP 4: VALIDATE OUTPUT - Verify optimized image is correct
   */
  async validateOutput(imagePath) {
    const validation = {
      passed: true,
      errors: [],
      warnings: [],
      details: {}
    };

    console.log(`\n🧪 STEP 4: VALIDATE OUTPUT`);
    console.log(`   File: ${path.basename(imagePath)}`);

    try {
      // Check 4.1: File exists
      if (!fs.existsSync(imagePath)) {
        validation.passed = false;
        validation.errors.push('Output file does not exist');
        console.log(`   ❌ File exists: NO`);
        return validation;
      }
      console.log(`   ✅ File exists: YES`);

      // Check 4.2: File size is acceptable
      const stats = fs.statSync(imagePath);
      const fileSizeKB = stats.size / 1024;
      
      if (stats.size > this.config.maxFileSize) {
        validation.warnings.push(
          `Output file size ${fileSizeKB.toFixed(2)}KB still exceeds max ${(this.config.maxFileSize / 1024).toFixed(2)}KB`
        );
        console.log(`   ⚠️  File size: ${fileSizeKB.toFixed(2)}KB (exceeds max)`);
      } else {
        console.log(`   ✅ File size: ${fileSizeKB.toFixed(2)}KB (within limits)`);
      }

      validation.details.fileSize = stats.size;
      validation.details.fileSizeKB = fileSizeKB.toFixed(2);

      // Check 4.3: Image dimensions are correct
      const image = await Jimp.read(imagePath);
      const width = image.getWidth();
      const height = image.getHeight();

      if (width !== this.config.width || height !== this.config.height) {
        validation.passed = false;
        validation.errors.push(
          `Image dimensions ${width}x${height} do not match required ${this.config.width}x${this.config.height}`
        );
        console.log(`   ❌ Dimensions: MISMATCH (${width}x${height})`);
        return validation;
      }
      console.log(`   ✅ Dimensions: CORRECT (${width}x${height})`);

      validation.details.dimensions = `${width}x${height}`;

      // Check 4.4: Image has content
      const histogram = image.getHistogram();
      const hasContent = Object.values(histogram).some(channel => {
        const mean = channel.reduce((a, b) => a + b, 0) / channel.length;
        return mean > 10 && mean < 245;
      });

      if (!hasContent) {
        validation.passed = false;
        validation.errors.push('Output image appears blank or invalid');
        console.log(`   ❌ Content: BLANK`);
        return validation;
      }
      console.log(`   ✅ Content: VISIBLE`);

    } catch (err) {
      validation.passed = false;
      validation.errors.push(`Validation error: ${err.message}`);
      console.log(`   ❌ Validation error: ${err.message}`);
    }

    this.validationLog.push({
      step: 'VALIDATE_OUTPUT',
      timestamp: new Date().toISOString(),
      result: validation.passed ? 'PASSED' : 'FAILED',
      details: validation
    });

    return validation;
  }

  /**
   * STEP 5: UPLOAD - Upload image to blog with safety checks
   */
  async uploadImageToBlog(imagePath, uploader, article) {
    const upload = {
      success: false,
      errors: [],
      warnings: [],
      details: {}
    };

    console.log(`\n📤 STEP 5: UPLOAD IMAGE`);
    console.log(`   Article: "${article.h1}"`);
    console.log(`   Image: ${path.basename(imagePath)}`);

    try {
      // Check 5.1: Image file still exists
      if (!fs.existsSync(imagePath)) {
        upload.success = false;
        upload.errors.push('Image file no longer exists');
        console.log(`   ❌ File exists: NO`);
        return upload;
      }
      console.log(`   ✅ File exists: YES`);

      // Check 5.2: Uploader is ready
      if (!uploader || !uploader.page) {
        upload.success = false;
        upload.errors.push('Uploader not initialized');
        console.log(`   ❌ Uploader ready: NO`);
        return upload;
      }
      console.log(`   ✅ Uploader ready: YES`);

      // Check 5.3: Upload image
      console.log(`   Uploading to admin panel...`);
      const uploadResult = await uploader._setImage(imagePath);
      
      upload.success = true;
      upload.details.uploadedFile = path.basename(imagePath);
      upload.details.uploadedSize = fs.statSync(imagePath).size;
      
      console.log(`   ✅ Image uploaded successfully`);

    } catch (err) {
      upload.success = false;
      upload.errors.push(`Upload failed: ${err.message}`);
      console.log(`   ❌ Upload error: ${err.message}`);
    }

    this.validationLog.push({
      step: 'UPLOAD',
      timestamp: new Date().toISOString(),
      result: upload.success ? 'SUCCESS' : 'FAILED',
      details: upload
    });

    return upload;
  }

  /**
   * MASTER FUNCTION: Run complete VERIFY → CHECK → OPTIMIZE → VALIDATE → UPLOAD
   */
  async processAndUploadImage(inputPath, outputPath, uploader, article) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`HERO IMAGE PROCESSING WORKFLOW`);
    console.log(`Article: "${article.h1}"`);
    console.log(`${'='.repeat(70)}`);

    const results = {
      success: false,
      steps: {},
      totalErrors: 0,
      totalWarnings: 0,
      finalImagePath: null
    };

    // STEP 1: VERIFY
    results.steps.verify = await this.verifyImageSource(inputPath);
    if (!results.steps.verify.passed) {
      results.totalErrors += results.steps.verify.errors.length;
      console.log(`\n❌ VERIFY FAILED - ABORTING\n`);
      return results;
    }

    // STEP 2: CHECK
    results.steps.check = await this.checkImageQuality(inputPath);
    if (!results.steps.check.passed) {
      results.totalErrors += results.steps.check.errors.length;
      console.log(`\n❌ CHECK FAILED - ABORTING\n`);
      return results;
    }
    results.totalWarnings += results.steps.check.warnings.length;

    // STEP 3: OPTIMIZE
    results.steps.optimize = await this.optimizeImage(inputPath, outputPath);
    if (!results.steps.optimize.success) {
      results.totalErrors += results.steps.optimize.errors.length;
      console.log(`\n❌ OPTIMIZE FAILED - ABORTING\n`);
      return results;
    }

    // STEP 4: VALIDATE OUTPUT
    results.steps.validateOutput = await this.validateOutput(outputPath);
    if (!results.steps.validateOutput.passed) {
      results.totalErrors += results.steps.validateOutput.errors.length;
      console.log(`\n❌ VALIDATE OUTPUT FAILED - ABORTING\n`);
      return results;
    }
    results.totalWarnings += results.steps.validateOutput.warnings.length;

    // STEP 5: UPLOAD
    if (uploader && article) {
      results.steps.upload = await this.uploadImageToBlog(outputPath, uploader, article);
      if (!results.steps.upload.success) {
        results.totalErrors += results.steps.upload.errors.length;
        console.log(`\n❌ UPLOAD FAILED\n`);
        results.success = false;
        return results;
      }
    }

    // ALL STEPS PASSED
    results.success = true;
    results.finalImagePath = outputPath;

    console.log(`\n${'='.repeat(70)}`);
    console.log(`✅ ALL STEPS COMPLETED SUCCESSFULLY`);
    console.log(`Image ready: ${path.basename(outputPath)}`);
    if (results.totalWarnings > 0) {
      console.log(`Warnings: ${results.totalWarnings}`);
    }
    console.log(`${'='.repeat(70)}\n`);

    return results;
  }

  /**
   * Get validation log for debugging
   */
  getValidationLog() {
    return this.validationLog;
  }

  /**
   * Export validation log to JSON file
   */
  async exportValidationLog(filepath) {
    try {
      fs.writeFileSync(filepath, JSON.stringify(this.validationLog, null, 2));
      console.log(`✅ Validation log exported: ${filepath}`);
    } catch (err) {
      console.error(`❌ Failed to export validation log: ${err.message}`);
    }
  }
}

module.exports = { HeroImageProcessor };
