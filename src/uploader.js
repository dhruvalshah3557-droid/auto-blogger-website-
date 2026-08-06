const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class BlogUploader {
  constructor(config) {
    this.config = config;
    this.browser = null;
    this.page = null;
  }

  async launch() {
    this.browser = await chromium.launch({ headless: this.config.headless });
    const context = await this.browser.newContext();
    this.page = await context.newPage();
  }

  async login() {
    const { loginUrl, username, password } = this.config.admin;
    await this.page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
    await this.page.fill('#UserName', username);
    await this.page.fill('#UserPassword', password);
    await this.page.click('#btnLogin');
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForURL(/Admin\/Dashboard/i, { timeout: 20000 }).catch(() => {});
    console.log('Logged in. Current URL:', this.page.url());
    if (!this.page.url().includes('/Admin/')) {
      throw new Error('Login failed: did not reach admin area.');
    }
  }

  async openBlogPage() {
    await this.page.goto(this.config.admin.blogUrl, { waitUntil: 'domcontentloaded' });
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForSelector('#Subject', { timeout: 15000 });
  }

  async _setSubject(title) {
    await this.page.fill('#Subject', title);
  }

  async _setBody(html) {
    await this.page.evaluate((bodyHtml) => {
      if (typeof window.tinymce !== 'undefined' && window.tinymce.get('DescpBody')) {
        window.tinymce.get('DescpBody').setContent(bodyHtml);
      } else {
        document.getElementById('DescpBody').value = bodyHtml;
      }
    }, html);
  }

  async _setImage(imagePath) {
    if (!imagePath) return;
    const mime = path.extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
    const b64 = fs.readFileSync(imagePath).toString('base64');
    await this.page.fill('#file', `data:${mime};base64,${b64}`);
  }

  async uploadPost(post) {
    if (this.page.url() !== this.config.admin.blogUrl) {
      await this.openBlogPage();
    }
    await this._setSubject(post.title);
    await this._setBody(post.content);
    if (post.imagePath) {
      await this._setImage(post.imagePath);
    }
    await this.page.click('#btnSave');
    await this.page.waitForTimeout(3000);
    const success = await this.page.evaluate(() => {
      const el = document.querySelector('.alert-success, .notify-success, #successMsg');
      return el ? el.innerText.trim() : '';
    });
    const url = this.page.url();
    console.log(`Uploaded: "${post.title}" (URL: ${url})`);
    return success;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

module.exports = { BlogUploader };
