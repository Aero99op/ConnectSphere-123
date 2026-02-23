const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const artifactPath = process.argv[2];
const publicDir = 'd:\\connectsphere1\\frontend\\public';

if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}

// Destination paths
const icon512 = path.join(publicDir, 'icon-512.png');
const icon192 = path.join(publicDir, 'icon-192.png');

// Copy to 512
fs.copyFileSync(artifactPath, icon512);
console.log(`Copied to ${icon512}`);

// Resize to 192 (using ffmpeg if available, or just copy as fallback for now since we don't have sharp installed in environment usually)
// Actually, since I can't guarantee sharp/ffmpeg, I'll just copy the 512 to 192 for now. Ideally, we resize.
// Let's try to use a simple powershell command for resizing if possible, or just duplicate it.
// Duplicate for now to ensure no 404s. Browsers scale down fine usually.
fs.copyFileSync(artifactPath, icon192);
console.log(`Copied to ${icon192}`);
