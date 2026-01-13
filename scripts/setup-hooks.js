import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const hooksSource = path.join(__dirname, '../hooks');
const hooksDest = path.join(__dirname, '../.git/hooks');

console.log('🔧 Setting up Git hooks...\n');

// Check if .git/hooks exists
if (!fs.existsSync(hooksDest)) {
  console.error('❌ .git/hooks directory not found. Are you in a Git repository?');
  process.exit(1);
}

// Check if hooks directory exists
if (!fs.existsSync(hooksSource)) {
  console.error('❌ hooks directory not found');
  process.exit(1);
}

// Copy all hooks
const hookFiles = fs.readdirSync(hooksSource);
let installedCount = 0;

hookFiles.forEach(hookFile => {
  const sourcePath = path.join(hooksSource, hookFile);
  const destPath = path.join(hooksDest, hookFile);

  // Only process files (not directories)
  if (fs.statSync(sourcePath).isFile()) {
    // Copy the file
    fs.copyFileSync(sourcePath, destPath);

    // Make it executable (chmod +x)
    fs.chmodSync(destPath, '755');

    console.log(`✓ Installed ${hookFile} hook`);
    installedCount++;
  }
});

console.log(`\n✅ Successfully installed ${installedCount} Git hook(s)`);
console.log('\n⚠️  Note: The pre-commit hook will build your app before every commit.');
console.log('   This ensures bundle size stays under 10 MB, but may slow down commits.');
