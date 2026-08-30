import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync, mkdirSync, cpSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

test('macOS: Le binaire Cours.app est Universal 2 (arm64 + x86_64) et signé ad-hoc avec runtime durci', () => {
  const binaryPath = '/Applications/Cours.app/Contents/MacOS/Cours';
  assert.ok(existsSync(binaryPath), 'Le binaire /Applications/Cours.app/Contents/MacOS/Cours doit exister');

  const lipoOutput = execSync(`lipo -info "${binaryPath}"`, { encoding: 'utf8' });
  assert.match(lipoOutput, /arm64/, 'Le binaire doit supporter arm64 (Apple Silicon)');
  assert.match(lipoOutput, /x86_64/, 'Le binaire doit supporter x86_64 (Intel)');

  const codesignOutput = execSync(`codesign -dvvv "/Applications/Cours.app" 2>&1`, { encoding: 'utf8' });
  assert.match(codesignOutput, /Identifier=fr\.ewilien\.biomia\.cours/, 'Identifier doit être fr.ewilien.biomia.cours');
  assert.match(codesignOutput, /adhoc/, 'Doit posséder une signature adhoc valide');
  assert.match(codesignOutput, /runtime/, 'Doit posséder le flag runtime durci');
});

test('macOS: Simulation de Quarantaine Gatekeeper et levée 1-clic via xattr -cr', () => {
  const testDir = '/tmp/cours-quarantine-test';
  rmSync(testDir, { recursive: true, force: true });
  mkdirSync(testDir, { recursive: true });

  const testApp = path.join(testDir, 'Cours.app');
  cpSync('/Applications/Cours.app', testApp, { recursive: true });

  // 1. Simuler l'attribut de quarantaine appliqué par Safari / Chrome
  const quarantineAttr = '0081;66d00000;Safari;44A1BE58-54BE-4BF6-8575-C2B1D3DF4A55';
  execSync(`xattr -w com.apple.quarantine "${quarantineAttr}" "${testApp}"`);

  const listBefore = execSync(`xattr "${testApp}"`, { encoding: 'utf8' });
  assert.match(listBefore, /com\.apple\.quarantine/, 'L\'attribut de quarantaine doit être présent après téléchargement');

  // 2. Exécuter la levée de quarantaine (comme le fait Ouvrir-Cours.command ou install.sh)
  execSync(`xattr -cr "${testApp}"`);

  const listAfter = execSync(`xattr "${testApp}"`, { encoding: 'utf8' });
  assert.doesNotMatch(listAfter, /com\.apple\.quarantine/, 'L\'attribut de quarantaine doit être totalement supprimé');

  rmSync(testDir, { recursive: true, force: true });
});

test('macOS: Les paquets de distribution (DMG, ZIP, PKG, script command) sont intègres', () => {
  const files = [
    path.join(ROOT, 'Cours-macOS.dmg'),
    path.join(ROOT, 'Cours-macOS.zip'),
    path.join(ROOT, 'Cours-macOS.pkg'),
    path.join(ROOT, 'landing', 'Cours-macOS.dmg'),
    path.join(ROOT, 'landing', 'Cours-macOS.zip'),
    path.join(ROOT, 'landing', 'Cours-macOS.pkg'),
    path.join(ROOT, 'landing', 'install.sh'),
    path.join(ROOT, 'landing', 'Installer-macOS.command'),
  ];

  for (const f of files) {
    assert.ok(existsSync(f), `Le fichier ${f} doit exister`);
  }

  // Vérifier le contenu du ZIP
  const zipListing = execSync(`unzip -l "${path.join(ROOT, 'Cours-macOS.zip')}"`, { encoding: 'utf8' });
  assert.match(zipListing, /Cours\.app\/Contents\/MacOS\/Cours/, 'ZIP doit contenir le binaire');
  assert.match(zipListing, /Ouvrir-Cours\.command/, 'ZIP doit contenir le script Ouvrir-Cours.command');
  assert.match(zipListing, /INSTRUCTIONS\.txt/, 'ZIP doit contenir les instructions de déblocage');
});

test('Réseau & Mobile: Endpoints API /api/devices et appairage /api/devices/pair', async () => {
  const TEST_PORT = 3098;
  const server = spawn('node', ['server.mjs'], {
    cwd: ROOT,
    env: { ...process.env, BIOMIA_PORT: String(TEST_PORT), BIOMIA_HOST: '127.0.0.1' },
    stdio: 'pipe',
  });

  try {
    // Attendre que le serveur démarre
    await new Promise((resolve) => setTimeout(resolve, 1200));

    // 1. Tester GET /api/devices
    const resGet = await fetch(`http://127.0.0.1:${TEST_PORT}/api/devices`);
    assert.equal(resGet.status, 200);
    const dataGet = await resGet.json();
    assert.equal(dataGet.ok, true);
    assert.ok(dataGet.localIp, 'localIp doit être retourné');
    assert.equal(dataGet.port, TEST_PORT);

    // 2. Tester POST /api/devices/pair avec simulateur Android Pixel 8
    const resPairAndroid = await fetch(`http://127.0.0.1:${TEST_PORT}/api/devices/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8)' },
      body: JSON.stringify({
        deviceId: 'sim-pixel-8-test',
        deviceName: 'Google Pixel 8 (Simulateur)',
        platform: 'Android 14',
      }),
    });
    assert.equal(resPairAndroid.status, 200);
    const dataPairAndroid = await resPairAndroid.json();
    assert.equal(dataPairAndroid.ok, true);

    // 3. Tester POST /api/devices/pair avec iPhone 16 Pro (iOS)
    const resPairIos = await fetch(`http://127.0.0.1:${TEST_PORT}/api/devices/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' },
      body: JSON.stringify({
        deviceId: 'sim-iphone-16-test',
        deviceName: 'iPhone 16 Pro (Simulateur)',
        platform: 'iOS 18.0',
      }),
    });
    assert.equal(resPairIos.status, 200);

    // 4. Vérifier que les 2 appareils sont bien enregistrés
    const resDevices = await fetch(`http://127.0.0.1:${TEST_PORT}/api/devices`);
    const devicesList = await resDevices.json();
    const pixel = devicesList.devices.find((d) => d.id === 'sim-pixel-8-test');
    const iphone = devicesList.devices.find((d) => d.id === 'sim-iphone-16-test');
    assert.ok(pixel, 'Pixel 8 doit être dans la liste des appareils connectés');
    assert.ok(iphone, 'iPhone 16 doit être dans la liste des appareils connectés');

    // 5. Tester le téléchargement des binaires statiques depuis le serveur
    const resDmg = await fetch(`http://127.0.0.1:${TEST_PORT}/Cours-macOS.dmg`);
    assert.equal(resDmg.status, 200);

    const resZip = await fetch(`http://127.0.0.1:${TEST_PORT}/Cours-macOS.zip`);
    assert.equal(resZip.status, 200);

    const resInstallScript = await fetch(`http://127.0.0.1:${TEST_PORT}/install.sh`);
    assert.equal(resInstallScript.status, 200);
  } finally {
    server.kill();
  }
});
