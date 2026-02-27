import type { Metadata, Viewport } from 'next'
import { Outfit, Inter } from 'next/font/google'
import './globals.css'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Toaster } from "sonner"
import { SplashLoader } from '@/components/ui/splash-loader'
import { GlobalHomeButton } from '@/components/layout/global-home-button'
import { CallManager } from '@/components/chat/call-manager'
import { NotificationListener } from '@/components/layout/notification-listener'

const interfaceFont = Inter({ subsets: ['latin'], variable: '--font-inter' })
const displayFont = Outfit({ subsets: ['latin'], variable: '--font-outfit' })

export const metadata: Metadata = {
    title: 'ConnectSphere | India\'s Premiere Social Media',
    description: 'Join the revolution. Share stories, report issues, and connect with your community.',
    manifest: '/manifest.json',
    icons: {
        icon: '/logo.svg',
        shortcut: '/logo.svg',
        apple: '/logo.svg',
    },
    openGraph: {
        title: 'ConnectSphere | India\'s Premiere Social Media',
        description: 'Join the revolution. Share stories, report issues, and connect with your community.',
        url: 'https://connectsphere.app',
        siteName: 'ConnectSphere',
        images: [
            {
                url: '/og-image.png', // Needs to be added to public
                width: 1200,
                height: 630,
            },
        ],
        locale: 'en_IN',
        type: 'website',
    },
}

export const viewport: Viewport = {
    themeColor: '#ff9933',
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
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
            </body>
        </html>
    )
}
