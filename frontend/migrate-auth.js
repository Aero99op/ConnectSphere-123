/**
 * Migration script to replace supabase.auth patterns with useAuth() hook
 * across all remaining component files.
 * 
 * Run: node migrate-auth.js
 */
const fs = require('fs');
const path = require('path');

// Files that have already been migrated or don't need migration
const SKIP_FILES = [
    'auth-provider.tsx',        // Already uses NextAuth
    'route.ts',                  // NextAuth route or API routes handled separately
];

// Files to migrate
const filesToMigrate = [
    // Feed components
    'components/feed/post-card.tsx',
    'components/feed/comment-sheet.tsx',
    'components/feed/share-sheet.tsx',
    'components/feed/story-viewer.tsx',
    'components/feed/post-options-sheet.tsx',
    // Chat components
    'components/chat/chat-list.tsx',
    'components/chat/chat-sidebar.tsx',
    'components/chat/chat-view.tsx',
    'components/chat/new-chat-dialog.tsx',
    'components/chat/add-group-members-dialog.tsx',
    'components/chat/create-group-dialog.tsx',
    'components/chat/messages-layout.tsx',
    // Dashboard
    'components/dashboard/department-dashboard.tsx',
    // Pages
    'app/page.tsx',
    'app/create/page.tsx',
    'app/profile/page.tsx',
    'app/profile/[id]/page.tsx',
    'app/notifications/page.tsx',
    'app/report/page.tsx',
    'app/role-selection/page.tsx',
    'app/settings/page.tsx',
    'app/settings/account/profile/page.tsx',
    'app/settings/account/privacy/page.tsx',
    'app/settings/preferences/notifications/page.tsx',
    'app/settings/preferences/language/page.tsx',
    'app/settings/preferences/data/page.tsx',
    'app/settings/preferences/appearance/page.tsx',
    // Hooks & Libs
    'hooks/use-peer.ts',
    'lib/storage.ts',
    // API routes
    'app/api/upload/route.ts',
];

const FRONTEND_ROOT = __dirname;

let totalChanged = 0;
let totalFiles = 0;

for (const relPath of filesToMigrate) {
    const fullPath = path.join(FRONTEND_ROOT, relPath);

    if (!fs.existsSync(fullPath)) {
        console.log(`SKIP (not found): ${relPath}`);
        continue;
    }

    let content = fs.readFileSync(fullPath, 'utf-8');
    const originalContent = content;
    let changed = false;

    // 1. Replace import: supabase -> useAuth (for .tsx files with components)
    if (relPath.endsWith('.tsx')) {
        // Add useAuth import if not already present
        if (!content.includes('useAuth') && content.includes('supabase.auth')) {
            content = content.replace(
                /import\s*{\s*supabase\s*}\s*from\s*["']@\/lib\/supabase["'];?/,
                'import { useAuth } from "@/components/providers/auth-provider";'
            );
            changed = true;
        }
    }

    // 2. Replace supabase.auth.getUser() pattern
    // Pattern: const { data: { user } } = await supabase.auth.getUser();
    content = content.replace(
        /const\s*{\s*data:\s*{\s*user\s*}\s*}\s*=\s*await\s*supabase\.auth\.getUser\(\);?/g,
        '// User from useAuth() hook - see component top'
    );

    // 3. Replace supabase.auth.getSession() pattern
    content = content.replace(
        /const\s*{\s*data:\s*{\s*session\s*}\s*}\s*=\s*await\s*supabase\.auth\.getSession\(\);?/g,
        '// Session from useAuth() hook - see component top'
    );

    // 4. Replace supabase.auth.signOut()
    content = content.replace(
        /await\s*supabase\.auth\.signOut\(\)/g,
        'await signOut()'
    );
    content = content.replace(
        /supabase\.auth\.signOut\(\)/g,
        'signOut()'
    );

    if (content !== originalContent) {
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(fullPath, content, 'utf-8');
        totalChanged++;
        console.log(`MIGRATED: ${relPath}`);
    } else {
        console.log(`NO CHANGE: ${relPath}`);
    }
    totalFiles++;
}

console.log(`\n--- Migration Summary ---`);
console.log(`Total files checked: ${totalFiles}`);
console.log(`Files modified: ${totalChanged}`);
console.log(`\nNOTE: Manual review still needed for:`);
console.log(`- Components using supabase.auth.onAuthStateChange()`);
console.log(`- Hooks that need the authenticated supabase client`);
console.log(`- Adding 'const { user, supabase, signOut } = useAuth();' to components`);
