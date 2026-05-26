const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Test 1: Date prefill and BBCH synchronization in bulk task
  await page.goto('http://localhost:8002/index.html');
  await page.waitForSelector('.field-checkbox');
  await page.click('.field-checkbox'); // Select first field
  await page.click('#bulk-actions-btn');
  await page.waitForSelector('#bulkTaskModal', { state: 'visible' });

  // Check date prefill
  const bulkDate = await page.inputValue('#bulk-task-date');
  console.log('Bulk Date Prefilled:', bulkDate);
  if (!bulkDate) throw new Error('Bulk date not prefilled');

  // Select Plant Protection and check Schadorganismus/Wartezeit fields
  await page.selectOption('#bulk-task-type', 'Pflanzenschutz');
  await page.fill('#bulk-psm-search', 'Test Product');
  await page.keyboard.press('Tab'); // Trigger change

  await page.waitForSelector('#bulk-product-list .row');
  await page.screenshot({ path: '/home/jules/verification/bulk_task_psm_v2.png' });

  // Test 2: Field Details date prefill and BBCH
  await page.goto('http://localhost:8002/field.html?id=1');
  const fieldDate = await page.inputValue('#task-date');
  console.log('Field Date Prefilled:', fieldDate);
  if (!fieldDate) throw new Error('Field date not prefilled');

  await page.selectOption('#task-type', 'Pflanzenschutz');
  await page.fill('#psm-search', 'Test Product');
  await page.keyboard.press('Tab'); // Trigger change

  await page.waitForSelector('#product-list .row');

  // Check BBCH description
  await page.fill('#bbch', '10');
  const description = await page.inputValue('#task-description');
  console.log('BBCH Description for 10:', description);

  await page.screenshot({ path: '/home/jules/verification/field_details_psm_v2.png', fullPage: true });

  await browser.close();
})();
