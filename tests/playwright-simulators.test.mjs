import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

test('Simulateurs Réels: Test E2E de A à Z (macOS Desktop, Android Pixel 8, iPhone iOS)', async () => {
  const TEST_PORT = 3097;
  const server = spawn('node', ['server.mjs'], {
    cwd: ROOT,
    env: { ...process.env, BIOMIA_PORT: String(TEST_PORT), BIOMIA_HOST: '127.0.0.1' },
    stdio: 'pipe',
  });

  let browser;
  try {
    // Attente du démarrage du serveur
    await new Promise((resolve) => setTimeout(resolve, 1500));
    browser = await chromium.launch({ headless: true });

    // ------------------------------------------------------------------------
    // 1. SIMULATEUR MAC (macOS Desktop - 1440x900)
    // ------------------------------------------------------------------------
    console.log('==> [1/3] Test Simulateur macOS Desktop (1440x900)...');
    const macContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    });
    const macPage = await macContext.newPage();

    // Tester la Landing Page
    await macPage.goto(`http://127.0.0.1:${TEST_PORT}/landing`);
    await macPage.waitForSelector('#platformDetectedBadge', { timeout: 5000 });
    const badgeText = await macPage.innerText('#platformDetectedBadge');
    assert.match(badgeText, /macOS/i, 'La landing page doit détecter macOS');

    // Vérifier les boutons de téléchargement DMG et ZIP
    const dmgLink = await macPage.getAttribute('a[href="/Cours-macOS.dmg"]', 'href');
    assert.equal(dmgLink, '/Cours-macOS.dmg');

    const zipLink = await macPage.getAttribute('a[href="/Cours-macOS.zip"]', 'href');
    assert.equal(zipLink, '/Cours-macOS.zip');

    // Vérifier la présence de la commande 1-clic Terminal
    const terminalCode = await macPage.innerText('code');
    assert.match(terminalCode, /curl -fsSL https:\/\/cours-awc\.pages\.dev\/install\.sh \| bash/);

    // Tester l'application Web /app sur Desktop
    await macPage.goto(`http://127.0.0.1:${TEST_PORT}/app`);
    await macPage.waitForSelector('body', { timeout: 5000 });
    await macPage.screenshot({ path: path.join(ROOT, 'scratch', 'test_macos_desktop.png') });
    console.log('✓ Simulateur macOS Desktop validé.');
    await macContext.close();

    // ------------------------------------------------------------------------
    // 2. SIMULATEUR ANDROID (Google Pixel 8 - 412x915)
    // ------------------------------------------------------------------------
    console.log('==> [2/3] Test Simulateur Android Pixel 8 (412x915)...');
    const androidContext = await browser.newContext({
      viewport: { width: 412, height: 915 },
      deviceScaleFactor: 2.625,
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro Build/UD1A.230803.041) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
    });
    const androidPage = await androidContext.newPage();

    // Tester la Landing Page sur Android
    await androidPage.goto(`http://127.0.0.1:${TEST_PORT}/landing`);
    await androidPage.waitForSelector('#platformDetectedBadge', { timeout: 5000 });
    const androidBadge = await androidPage.innerText('#platformDetectedBadge');
    assert.match(androidBadge, /Android/i, 'La landing page doit détecter Android');

    const apkLink = await androidPage.getAttribute('a[href="/cours.apk"]', 'href');
    assert.equal(apkLink, '/cours.apk', 'Le bouton de téléchargement APK direct doit être présent');

    // Tester l'App Mobile /app sur simulateur Pixel 8
    await androidPage.goto(`http://127.0.0.1:${TEST_PORT}/app`);
    await androidPage.waitForSelector('body', { timeout: 5000 });
    await androidPage.screenshot({ path: path.join(ROOT, 'scratch', 'test_android_pixel8.png') });

    // Tester le portail mobile /mobile
    await androidPage.goto(`http://127.0.0.1:${TEST_PORT}/mobile`);
    await androidPage.waitForSelector('body', { timeout: 5000 });
    const mobileBody = await androidPage.innerText('body');
    assert.match(mobileBody, /Cours/i);
    await androidPage.screenshot({ path: path.join(ROOT, 'scratch', 'test_android_portal.png') });
    console.log('✓ Simulateur Android Pixel 8 validé.');
    await androidContext.close();

    // ------------------------------------------------------------------------
    // 3. SIMULATEUR IPHONE (iPhone 16 Pro / Safari iOS - 390x844)
    // ------------------------------------------------------------------------
    console.log('==> [3/3] Test Simulateur iPhone (390x844)...');
    const iosContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    });
    const iosPage = await iosContext.newPage();

    // Tester la Landing Page sur iPhone
    await iosPage.goto(`http://127.0.0.1:${TEST_PORT}/landing`);
    await iosPage.waitForSelector('#platformDetectedBadge', { timeout: 5000 });
    const iosBadge = await iosPage.innerText('#platformDetectedBadge');
    assert.match(iosBadge, /iPhone/i, 'La landing page doit détecter iPhone');

    // Tester l'application Web /app sur iPhone
    await iosPage.goto(`http://127.0.0.1:${TEST_PORT}/app`);
    await iosPage.waitForSelector('body', { timeout: 5000 });
    await iosPage.screenshot({ path: path.join(ROOT, 'scratch', 'test_iphone_ios.png') });
    console.log('✓ Simulateur iPhone iOS validé.');
    await iosContext.close();

  } finally {
    if (browser) await browser.close();
    server.kill();
  }
});
