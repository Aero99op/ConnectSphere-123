const withNextIntl = require('next-intl/plugin')();

/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'files.catbox.moe',
            },
            {
                protocol: 'https',
                hostname: 'api.telegram.org',
            },
            {
                protocol: 'https',
                hostname: 'i.imgur.com',
            },
            {
                protocol: 'https',
                hostname: 'api.dicebear.com',
            },
        ],
    },
    // Security headers are handled in middleware.ts (Edge Runtime)
    // next.config.js headers are only a fallback and often lead to conflicts on Cloudflare.
    eslint: {
        ignoreDuringBuilds: false,
    },
    typescript: {
        ignoreBuildErrors: false,
    },
    experimental: {
        workerThreads: false,
        cpus: 1,
    },
    compiler: {
        removeConsole: process.env.NODE_ENV === 'production'
            ? { exclude: ['error', 'warn'] }
            : false,
    }
};

module.exports = withNextIntl(nextConfig);
