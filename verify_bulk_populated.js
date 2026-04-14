const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Go to the app
  await page.goto('http://localhost:8000');

  // Wait for fields to load
  await page.waitForSelector('.field-item');

  // Click Bulk Action button
  await page.click('#bulk-action-btn');

  // Wait for modal
  await page.waitForSelector('#bulk-task-modal', { state: 'visible' });

  // Take a screenshot of the populated list
  await page.screenshot({ path: 'bulk_modal_populated.png' });

  // Filter for something that exists (assuming 'Wheat' or similar exists from my previous test imports)
  // Actually I don't know what's in the DB right now.
  // Let's just take the screenshot of the whole list.

  await browser.close();
})();
