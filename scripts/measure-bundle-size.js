import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse command line arguments
const args = process.argv.slice(2);
const maxSizeArg = args.find(arg => arg.startsWith('--max-size='));
const maxSizeMB = maxSizeArg ? parseFloat(maxSizeArg.split('=')[1]) : null;

function getDirectorySize(dirPath) {
  let totalSize = 0;

  function traverseDir(currentPath) {
    try {
      const stats = fs.statSync(currentPath);

      if (stats.isFile()) {
        totalSize += stats.size;
      } else if (stats.isDirectory()) {
        const files = fs.readdirSync(currentPath);
        files.forEach(file => {
          traverseDir(path.join(currentPath, file));
        });
      }
    } catch (err) {
      console.error(`Error reading ${currentPath}: ${err.message}`);
    }
  }

  traverseDir(dirPath);
  return totalSize;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// macOS bundle paths
const bundlePath = path.join(__dirname, '../src-tauri/target/release/bundle/macos/Chatlite.app');
const dmgGlob = path.join(__dirname, '../src-tauri/target/release/bundle/dmg');

console.log('Measuring macOS distribution size...\n');

let foundAny = false;
let appBundleSize = 0;

// Check app bundle
if (fs.existsSync(bundlePath)) {
  const size = getDirectorySize(bundlePath);
  appBundleSize = size;
  const sizeMB = size / 1024 / 1024;

  console.log(`✓ App Bundle (.app)`);
  console.log(`  Path: ${bundlePath}`);
  console.log(`  Size: ${formatSize(size)}`);

  if (maxSizeMB !== null) {
    console.log(`  Limit: ${maxSizeMB} MB`);
    if (sizeMB > maxSizeMB) {
      console.log(`  ✗ EXCEEDS LIMIT by ${(sizeMB - maxSizeMB).toFixed(2)} MB\n`);
    } else {
      console.log(`  ✓ Within limit (${(maxSizeMB - sizeMB).toFixed(2)} MB remaining)\n`);
    }
  } else {
    console.log('');
  }

  foundAny = true;
} else {
  console.log(`✗ App Bundle not found at: ${bundlePath}\n`);
}

// Check DMG files
if (fs.existsSync(dmgGlob)) {
  const dmgFiles = fs.readdirSync(dmgGlob).filter(file => file.endsWith('.dmg'));

  if (dmgFiles.length > 0) {
    dmgFiles.forEach(dmgFile => {
      const dmgPath = path.join(dmgGlob, dmgFile);
      const stats = fs.statSync(dmgPath);
      console.log(`✓ DMG Installer`);
      console.log(`  File: ${dmgFile}`);
      console.log(`  Size: ${formatSize(stats.size)}\n`);
      foundAny = true;
    });
  } else {
    console.log(`✗ No DMG files found in: ${dmgGlob}\n`);
  }
} else {
  console.log(`✗ DMG directory not found at: ${dmgGlob}\n`);
}

if (!foundAny) {
  console.log('No macOS distribution files found. Run "bun run tauri build" first.');
  process.exit(1);
}

// Check if size exceeds limit
if (maxSizeMB !== null && appBundleSize > 0) {
  const sizeMB = appBundleSize / 1024 / 1024;
  if (sizeMB > maxSizeMB) {
    console.error(`\n❌ App bundle size (${sizeMB.toFixed(2)} MB) exceeds limit of ${maxSizeMB} MB`);
    process.exit(1);
  }
}
