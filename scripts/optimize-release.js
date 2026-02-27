#!/usr/bin/env node
/**
 * Post-build optimization script for Tauri releases
 * 
 * This script:
 * 1. Optionally applies UPX compression to the binary
 * 2. Reports final bundle sizes
 * 
 * Usage:
 *   node scripts/optimize-release.js [--upx]
 * 
 * Note: UPX compression can reduce binary size by ~50% but may trigger
 * antivirus false positives on Windows and increase startup time slightly.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const useUpx = args.includes('--upx');

// Paths
const MACOS_BUNDLE = path.join(__dirname, '../src-tauri/target/release/bundle/macos/Chatlite.app');
const MACOS_BINARY = path.join(MACOS_BUNDLE, 'Contents/MacOS/chatlite');

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function getFileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

function checkUpx() {
  try {
    execSync('which upx', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

console.log('🔧 Tauri Bundle Optimizer\n');

// Check if bundle exists
if (!fs.existsSync(MACOS_BINARY)) {
  console.error(`❌ Binary not found at: ${MACOS_BINARY}`);
  console.error('   Run "bun run tauri build" first.');
  process.exit(1);
}

const originalSize = getFileSize(MACOS_BINARY);
console.log(`📦 Original binary size: ${formatSize(originalSize)}`);

// Apply UPX compression if requested
if (useUpx) {
  if (!checkUpx()) {
    console.warn('\n⚠️  UPX not found. Install it with:');
    console.warn('   macOS: brew install upx');
    console.warn('   Linux: apt install upx');
    console.warn('   Windows: choco install upx');
    process.exit(1);
  }

  console.log('\n🗜️  Applying UPX compression...');
  
  try {
    // Backup original
    const backupPath = `${MACOS_BINARY}.backup`;
    fs.copyFileSync(MACOS_BINARY, backupPath);
    
    // Apply UPX with best compression
    // --best: slowest but best compression
    // --lzma: use LZMA algorithm (better than UCL)
    execSync(`upx --best --lzma "${MACOS_BINARY}"`, { stdio: 'inherit' });
    
    const compressedSize = getFileSize(MACOS_BINARY);
    const savings = originalSize - compressedSize;
    const percent = ((savings / originalSize) * 100).toFixed(1);
    
    console.log(`\n✅ UPX compression complete!`);
    console.log(`   Compressed size: ${formatSize(compressedSize)}`);
    console.log(`   Savings: ${formatSize(savings)} (${percent}%)`);
    
    // Remove backup
    fs.unlinkSync(backupPath);
    
  } catch (error) {
    console.error('\n❌ UPX compression failed:', error.message);
    
    // Restore backup if it exists
    const backupPath = `${MACOS_BINARY}.backup`;
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, MACOS_BINARY);
      fs.unlinkSync(backupPath);
      console.log('   Original binary restored.');
    }
    process.exit(1);
  }
} else {
  console.log('\n💡 Tip: Use --upx flag for additional ~50% compression');
  console.log('   Note: UPX may slightly increase startup time');
}

// Report bundle contents
console.log('\n📊 Bundle Contents:');
const getDirSize = (dirPath) => {
  let total = 0;
  const files = fs.readdirSync(dirPath, { recursive: true });
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);
    if (stat.isFile()) total += stat.size;
  }
  return total;
};

if (fs.existsSync(MACOS_BUNDLE)) {
  const bundleSize = getDirSize(MACOS_BUNDLE);
  console.log(`   .app bundle: ${formatSize(bundleSize)}`);
}

console.log('\n✨ Done!');
