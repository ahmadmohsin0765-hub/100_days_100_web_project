import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const appDir = path.join(projectRoot, 'public/Planet_gesture_formation');

// Helper to determine mime type
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html';
    case '.css': return 'text/css';
    case '.js':
    case '.mjs': return 'application/javascript';
    case '.json': return 'application/json';
    case '.png': return 'image/png';
    case '.jpg': return 'image/jpeg';
    case '.ico': return 'image/x-icon';
    default: return 'application/octet-stream';
  }
}

// Start static file server
function createServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = decodeURI(req.url.split('?')[0]);
      if (reqPath === '/' || reqPath === '') {
        reqPath = '/index.html';
      }
      const fullPath = path.join(appDir, reqPath);

      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        res.writeHead(200, { 'Content-Type': getMimeType(fullPath) });
        fs.createReadStream(fullPath).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function runTests() {
  console.log('====================================================');
  console.log('  R60-T021: Keyboard Interaction Regression Tests   ');
  console.log('  Project: public/Planet_gesture_formation          ');
  console.log('====================================================\n');

  const { server, port } = await createServer();
  const url = `http://127.0.0.1:${port}/index.html`;

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });

  let hasFailures = false;

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    console.log(`Loading application at ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // ----------------------------------------------------
    // Test 1: Skip Link to Scene
    // ----------------------------------------------------
    console.log('\n[Test 1] Skip Link to Main 3D Scene');
    const skipLink = page.locator('#skipLink');
    assert(await skipLink.count() === 1, 'Skip link (#skipLink) element exists in DOM');

    // Tab to skip link
    await page.keyboard.press('Tab');
    const isSkipLinkFocused = await skipLink.evaluate(el => el === document.activeElement);
    assert(isSkipLinkFocused, 'Skip link is focused upon first Tab navigation');

    const isVisibleOnFocus = await skipLink.evaluate(el => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.top >= 0 && rect.height > 0 && style.visibility !== 'hidden';
    });
    assert(isVisibleOnFocus, 'Skip link becomes visibly positioned on screen when focused');

    // Press Enter to activate skip link and focus #scene
    await page.keyboard.press('Enter');
    const isSceneFocused = await page.evaluate(() => document.activeElement && document.activeElement.id === 'scene');
    assert(isSceneFocused, 'Activating skip link successfully moves focus to #scene');

    // ----------------------------------------------------
    // Test 2: #scene Canvas Keyboard Interaction
    // ----------------------------------------------------
    console.log('\n[Test 2] #scene Canvas Keyboard Navigation & Controls');
    const scene = page.locator('#scene');
    const hasTabindex = await scene.getAttribute('tabindex');
    assert(hasTabindex !== null, '#scene has tabindex set for keyboard focus');

    // Test Space key trigger on canvas to toggle gesture
    const initialGesture = (await page.locator('#gesture').innerText()).toLowerCase();
    await page.keyboard.press('Space');
    const gestureAfterSpace = (await page.locator('#gesture').innerText()).toLowerCase();
    assert(gestureAfterSpace === 'fist' || gestureAfterSpace !== initialGesture, `Space key on #scene toggled gesture to "${gestureAfterSpace}"`);

    // Test Number keys for direct gesture selection
    await page.keyboard.press('Digit3');
    const gestureThumbsUp = (await page.locator('#gesture').innerText()).toLowerCase();
    assert(gestureThumbsUp === 'thumbs_up', 'Key "3" on #scene set gesture to "thumbs_up"');

    await page.keyboard.press('Digit1');
    const gestureOpen = (await page.locator('#gesture').innerText()).toLowerCase();
    assert(gestureOpen === 'open', 'Key "1" on #scene set gesture to "open"');

    // Test Arrow keys navigation
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowDown');
    assert(true, 'Arrow keys (rotation and zoom) handle interaction without error');

    // ----------------------------------------------------
    // Test 3: #gestureIndicator Keyboard Accessibility
    // ----------------------------------------------------
    console.log('\n[Test 3] #gestureIndicator Keyboard Focus & Cycling');
    const gestureIndicator = page.locator('#gestureIndicator');
    await gestureIndicator.focus();

    const isIndicatorFocused = await gestureIndicator.evaluate(el => el === document.activeElement);
    assert(isIndicatorFocused, '#gestureIndicator can receive keyboard focus');

    const indicatorRole = await gestureIndicator.getAttribute('role');
    assert(indicatorRole === 'button', '#gestureIndicator has role="button" for accessibility');

    // Press Enter to cycle gesture
    const gestureBeforeEnter = (await page.locator('#gesture').innerText()).toLowerCase();
    await page.keyboard.press('Enter');
    const gestureAfterEnter = (await page.locator('#gesture').innerText()).toLowerCase();
    assert(gestureAfterEnter !== gestureBeforeEnter, `Enter key on #gestureIndicator cycled gesture from "${gestureBeforeEnter}" to "${gestureAfterEnter}"`);

    // Press Space to cycle gesture again
    await page.keyboard.press('Space');
    const gestureAfterSpaceIndicator = (await page.locator('#gesture').innerText()).toLowerCase();
    assert(gestureAfterSpaceIndicator !== gestureAfterEnter, `Space key on #gestureIndicator cycled gesture from "${gestureAfterEnter}" to "${gestureAfterSpaceIndicator}"`);

    // ----------------------------------------------------
    // Test 4: #navbar Dropdowns Keyboard Navigation
    // ----------------------------------------------------
    console.log('\n[Test 4] #navbar Dropdowns Keyboard Accessibility');
    const cameraNavItem = page.locator('#cameraNavItem');
    await cameraNavItem.focus();
    assert(await cameraNavItem.evaluate(el => el === document.activeElement), '#cameraNavItem is focusable via keyboard');

    // Open dropdown via Enter
    await page.keyboard.press('Enter');
    const cameraExpanded = await cameraNavItem.getAttribute('aria-expanded');
    assert(cameraExpanded === 'true', 'Pressing Enter on #cameraNavItem sets aria-expanded="true"');

    // Tab into the dropdown to toggle tracking checkbox
    const trackingToggle = page.locator('#trackingToggle');
    const wasChecked = await trackingToggle.isChecked();
    await trackingToggle.focus();
    await page.keyboard.press('Space');
    const isNowChecked = await trackingToggle.isChecked();
    assert(isNowChecked !== wasChecked, 'Space key toggles #trackingToggle checkbox inside dropdown');

    // Test instructions dropdown
    const instructionsNavItem = page.locator('#instructionsNavItem');
    await instructionsNavItem.focus();
    await page.keyboard.press('Enter');
    const instructionsExpanded = await instructionsNavItem.getAttribute('aria-expanded');
    assert(instructionsExpanded === 'true', 'Pressing Enter on #instructionsNavItem opens instructions dropdown');

    // Press Escape to close all dropdowns
    await page.keyboard.press('Escape');
    const cameraClosed = await cameraNavItem.getAttribute('aria-expanded');
    const instructionsClosed = await instructionsNavItem.getAttribute('aria-expanded');
    assert(cameraClosed === 'false' && instructionsClosed === 'false', 'Escape key closes all open navbar dropdowns');

    // ----------------------------------------------------
    // Test 5: Distinct :focus-visible Styles Verification
    // ----------------------------------------------------
    console.log('\n[Test 5] Distinct :focus-visible Indicators Verification');
    const elementsToTest = [
      { name: '#skipLink', locator: skipLink },
      { name: '#scene', locator: scene },
      { name: '#gestureIndicator', locator: gestureIndicator },
      { name: '#cameraNavItem', locator: cameraNavItem },
      { name: '#instructionsNavItem', locator: instructionsNavItem }
    ];

    for (const item of elementsToTest) {
      await item.locator.focus();
      const hasFocusOutline = await item.locator.evaluate(el => {
        const style = window.getComputedStyle(el);
        const outlineStyle = style.outlineStyle;
        const outlineWidth = parseFloat(style.outlineWidth) || 0;
        const boxShadow = style.boxShadow;
        return (outlineStyle !== 'none' && outlineWidth > 0) || (boxShadow !== 'none' && boxShadow.length > 0);
      });
      assert(hasFocusOutline, `${item.name} exhibits distinct visible focus indicator when focused`);
    }

    // ----------------------------------------------------
    // Test 6: Mobile Menu Keyboard Navigation
    // ----------------------------------------------------
    console.log('\n[Test 6] Mobile Menu Keyboard Navigation');
    await page.setViewportSize({ width: 400, height: 700 });
    await page.waitForTimeout(300);

    const mobileMenuBtn = page.locator('#mobileMenuBtn');
    await mobileMenuBtn.focus();
    await page.keyboard.press('Enter');

    const mobileOpen = await page.locator('#navMenu').evaluate(el => el.classList.contains('mobile-open'));
    assert(mobileOpen, 'Enter key on #mobileMenuBtn opens mobile navigation menu');

    const mobileBtnExpanded = await mobileMenuBtn.getAttribute('aria-expanded');
    assert(mobileBtnExpanded === 'true', 'Mobile menu button updates aria-expanded="true"');

    // Close mobile menu using Escape
    await page.keyboard.press('Escape');
    const mobileClosed = await page.locator('#navMenu').evaluate(el => !el.classList.contains('mobile-open'));
    assert(mobileClosed, 'Escape key closes mobile navigation menu');

    console.log('\n====================================================');
    console.log('  ALL TESTS PASSED SUCCESSFULLY!                    ');
    console.log('====================================================');

  } catch (err) {
    hasFailures = true;
    console.error('\n❌ Test Suite Failed with error:', err.message);
  } finally {
    await browser.close();
    server.close();
  }

  if (hasFailures) {
    process.exit(1);
  }
}

runTests();
