const { chromium } = require('playwright');

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
    const { loginUrl, username, password, dashboardUrl } = this.config.admin;
    await this.page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
    await this.page.fill('#UserName', username);
    await this.page.fill('#UserPassword', password);
    await this.page.click('#btnLogin');
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForURL(/Dashboard|Admin/i, { timeout: 15000 }).catch(() => {});
    console.log('Logged in. Current URL:', this.page.url());
    if (!this.page.url().includes('/Admin/')) {
      throw new Error('Login failed: did not reach admin area.');
    }
  }

  async _openBlogPage() {
    await this.page.goto(this.config.admin.blogUrl, { waitUntil: 'domcontentloaded' });
    await this.page.waitForLoadState('domcontentloaded');
    console.log('Blog page URL:', this.page.url());
  }

  async _findCreateButton() {
    const candidates = [
      'a:has-text("Add")',
      'a:has-text("New")',
      'a:has-text("Create")',
      'button:has-text("Add")',
      'button:has-text("New")',
      'button:has-text("Create")',
    ];
    for (const sel of candidates) {
      const el = this.page.locator(sel).first();
      if (await el.isVisible().catch(() => false)) {
        return el;
      }
    }
    return null;
  }

  async _fillSmart(fieldName, value) {
    const lower = fieldName.toLowerCase();
    const locators = [
      `input[name*="${fieldName}"]`,
      `textarea[name*="${fieldName}"]`,
      `input[placeholder*="${fieldName}"]`,
      `textarea[placeholder*="${fieldName}"]`,
      `label:has-text("${fieldName}") >> xpath=following::input[1]`,
    ];
    for (const sel of locators) {
      const el = this.page.locator(sel).first();
      if (await el.isVisible().catch(() => false)) {
        await el.fill(value);
        return true;
      }
    }
    console.warn(`Could not locate field for "${fieldName}"`);
    return false;
  }

  async uploadPost(post) {
    const blogPage = await this.page.goto(this.config.admin.blogUrl, { waitUntil: 'domcontentloaded' });
    const createBtn = await this._findCreateButton();
    if (!createBtn) {
      throw new Error('Could not find the create/blog button on the blog page. Need manual mapping.');
    }
    await createBtn.click();
    await this.page.waitForLoadState('domcontentloaded');

    await this._fillSmart('Title', post.title);
    await this._fillSmart('ShortDescription', post.description);
    await this._fillSmart('Description', post.content);

    const saveBtn = await this._findSaveButton();
    if (!saveBtn) {
      throw new Error('Could not find save/submit button on blog form. Need manual mapping.');
    }
    await saveBtn.click();
    await this.page.waitForLoadState('domcontentloaded');
    console.log(`Uploaded: "${post.title}"`);
  }

  async _findSaveButton() {
    const candidates = [
      'button[type="submit"]',
      'input[type="submit"]',
      'a:has-text("Save")',
      'button:has-text("Save")',
      'button:has-text("Submit")',
      'button:has-text("Post")',
    ];
    for (const sel of candidates) {
      const el = this.page.locator(sel).first();
      if (await el.isVisible().catch(() => false)) {
        return el;
      }
    }
    return null;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

module.exports = { BlogUploader };
