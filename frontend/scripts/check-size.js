const fs = require('fs');
const path = require('path');

const MAX_SIZE_MIB = 24.5; // Slightly below 25MiB Cloudflare limit
const MAX_SIZE_BYTES = MAX_SIZE_MIB * 1024 * 1024;

const dirsToCheck = ['./.next', './public'];
let foundLargeFiles = false;

function formatSize(bytes) {
    return (bytes / (1024 * 1024)).toFixed(2) + ' MiB';
}

function checkDir(dirPath) {
    if (!fs.existsSync(dirPath)) return;

    const files = fs.readdirSync(dirPath);

    files.forEach(file => {
        const fullPath = path.join(dirPath, file);
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
            checkDir(fullPath);
        } else {
            if (stats.size > MAX_SIZE_BYTES) {
                console.error(`\x1b[31m[LIMIT REACHED]\x1b[0m ${fullPath} is ${formatSize(stats.size)}`);
                foundLargeFiles = true;
            }
        }
    });
}

console.log(`\x1b[34m[ConnectSphere]\x1b[0m Checking for files > ${MAX_SIZE_MIB} MiB...`);

dirsToCheck.forEach(dir => {
    checkDir(dir);
});

if (foundLargeFiles) {
    console.error(`\x1b[31m[FAIL]\x1b[0m One or more files are too large for Cloudflare Pages (25MiB limit).`);
    process.exit(1);
} else {
    console.log(`\x1b[32m[PASS]\x1b[0m All files are within Cloudflare's 25MiB limit.`);
    process.exit(0);
}
