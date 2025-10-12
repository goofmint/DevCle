import { test } from '@playwright/test';

test('Debug DOM structure', async ({ page }) => {
  await page.goto('http://localhost:3000/terms');

  // Toggle to dark mode
  const darkModeToggle = page.getByRole('button', { name: /Switch to dark mode/i });
  await darkModeToggle.click();
  await page.waitForTimeout(500);

  // Get the article element
  const article = page.locator('article');
  const articleClasses = await article.getAttribute('class');
  console.log('Article classes:', articleClasses);

  // Get the h1 element
  const h1 = page.getByRole('heading', { level: 1 });
  const h1Classes = await h1.getAttribute('class');
  const h1Styles = await h1.evaluate((el) => {
    const computed = window.getComputedStyle(el);
    return {
      color: computed.color,
      fontSize: computed.fontSize,
      fontWeight: computed.fontWeight,
    };
  });
  console.log('H1 classes:', h1Classes);
  console.log('H1 computed styles:', h1Styles);

  // Get the article's innerHTML to see structure
  const articleHTML = await article.evaluate((el) => el.innerHTML.substring(0, 500));
  console.log('Article HTML (first 500 chars):', articleHTML);

  // Get all classes applied
  const allElements = await page.locator('article *').evaluateAll((elements) => {
    return elements.slice(0, 5).map((el) => ({
      tag: el.tagName,
      classes: el.className,
    }));
  });
  console.log('First 5 elements in article:', JSON.stringify(allElements, null, 2));
});
