/** @type {import('next').NextConfig} */
const crypto = require('crypto');

const nextConfig = {
    // SECURITY FIX (MED-04): Suppress X-Powered-By header
    poweredByHeader: false,
    // SECURITY FIX (MED-04): Randomize build ID to prevent version fingerprinting
    generateBuildId: async () => crypto.randomBytes(16).toString('hex'),
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
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    experimental: {
        workerThreads: false,
        cpus: 1,
    },
    webpack: (config, { isServer, nextRuntime }) => {
        if (nextRuntime === 'edge') {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                async_hooks: false,
                fs: false,
                path: false,
            };
        }
        return config;
    },
    compiler: {
        removeConsole: process.env.NODE_ENV === 'production'
            ? { exclude: ['error', 'warn'] }
            : false,
    }
};

module.exports = nextConfig;
