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
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'X-DNS-Prefetch-Control',
                        value: 'on'
                    },
                    {
                        key: 'Strict-Transport-Security',
                        value: 'max-age=63072000; includeSubDomains; preload'
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'SAMEORIGIN'
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff'
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'origin-when-cross-origin'
                    },
                    {
                        key: 'Content-Security-Policy',
                        value: "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: wss:; img-src 'self' https: data: blob:; script-src 'self' 'unsafe-eval' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; font-src 'self' data: https:; connect-src 'self' https: wss:;"
                    }
                ]
            }
        ];
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    experimental: {
        workerThreads: false,
        cpus: 1,
    }
};

module.exports = nextConfig;
