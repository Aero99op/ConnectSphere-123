import type { Metadata, Viewport } from 'next'
import { Outfit, Inter } from 'next/font/google'
import './globals.css'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Toaster } from "sonner"
import { SplashLoader } from '@/components/ui/splash-loader'
import { GlobalHomeButton } from '@/components/layout/global-home-button'
import { CallManager } from '@/components/chat/call-manager'
import { NotificationListener } from '@/components/layout/notification-listener'
import { AuthProvider } from '@/components/providers/auth-provider'
import { LanguageProvider } from '@/components/providers/language-provider'
import { OnboardingGuard } from '@/components/providers/onboarding-guard'
import { ApinatorProvider } from '@/components/providers/apinator-provider'
import { PresenceProvider } from '@/components/providers/presence-provider'

const interfaceFont = Inter({ subsets: ['latin'], variable: '--font-inter' })
const displayFont = Outfit({ subsets: ['latin'], variable: '--font-outfit' })

const siteConfig = {
    name: 'Connect',
    description: 'India\'s Premiere Social Media Platform',
    url: 'https://connectsphere.app', // Internal domain stays same
    ogImage: '/og-image.png',
}

export const metadata: Metadata = {
    title: 'Connect | India\'s Premiere Social Media',
    description: 'Connect with your community, share stories, and report civic issues directly to authorities.',
    keywords: ['social media', 'india', 'civic reporting', 'connect'],
    authors: [{ name: 'Team 900B' }],
    creator: 'Team 900B',
    publisher: 'Team 900B',
    formatDetection: {
        email: false,
        address: false,
        telephone: false,
    },
    metadataBase: new URL(siteConfig.url),
    alternates: {
        canonical: '/',
    },
    manifest: '/manifest.json', // 🔱 Removed crossOrigin="use-credentials" requirement
    icons: {
        icon: '/logo.svg',
        shortcut: '/logo.svg',
        apple: '/logo.svg',
    },
    openGraph: {
        type: 'website',
        locale: 'en_IN',
        url: siteConfig.url,
        title: 'Connect | India\'s Premiere Social Media',
        description: 'India\'s first hyper-local civic-social network.',
        siteName: 'Connect',
        images: [
            {
                url: siteConfig.ogImage,
                width: 1200,
                height: 630,
                alt: 'Connect',
            },
        ],
    },
}

export const viewport: Viewport = {
    themeColor: '#ff9933',
    width: 'device-width',
    initialScale: 1,
    // maximumScale removed (Finding ADDITIONAL-2)
    userScalable: true, // Enabled for accessibility
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" className={`dark ${interfaceFont.variable} ${displayFont.variable}`}>
            {/* body: h-screen w-screen overflow-hidden to allow page.tsx to handle scrolling */}
            <body className="antialiased font-sans bg-background text-foreground w-screen h-screen overflow-hidden m-0 p-0 selection:bg-primary/30">
                <AuthProvider>
                    <LanguageProvider>
                        <OnboardingGuard>
                            <ApinatorProvider>
                                <PresenceProvider>
                                    <div className="fixed inset-0 bg-[radial-gradient(circle_at_2px_2px,_rgba(255,255,255,0.02)_1px,_transparent_0)] bg-[size:40px_40px] pointer-events-none" />

                                    {/* 🚀 Premium Splash Screen */}
                                    <SplashLoader />

                                    {/* Real-time Interaction Alerts 🔔 */}
                                    <NotificationListener />

                                    {/* Global Home Button for Citizen Mode */}
                                    <GlobalHomeButton />

                                    {/* Video Call Manager (Global Listener) */}
                                    <CallManager />

                                    {/* Main Content - Full Width & Centered */}
                                    <main className="w-full h-full overflow-y-auto pb-24 transition-all duration-300">
                                        <div className="mx-auto w-full h-full max-w-5xl">
                                            {children}
                                        </div>
                                    </main>

                                    {/* Navigation Dock - Now a fixed footer managed internally by BottomNav */}
                                    <BottomNav />

                                    <Toaster position="top-center" />
                                </PresenceProvider>
                            </ApinatorProvider>
                        </OnboardingGuard>
                    </LanguageProvider>
                </AuthProvider>
            </body>
        </html>
    )
}
