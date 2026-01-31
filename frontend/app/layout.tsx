import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GameRoomProvider } from "@/context/roomContext";
import { WebsocketProvider } from "@/context/wsContext";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { PreloadImages } from "@/components/PreloadImages";
import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Flip Flop",
    description:
        "Play Flip Flop online with friends! A game by Masahiro Nakajima",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang='en'>
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            >
                <ThemeProvider
                    attribute='class'
                    defaultTheme='dark'
                    enableSystem
                    disableTransitionOnChange
                >
                    <WebsocketProvider>
                        <GameRoomProvider>{children}</GameRoomProvider>
                        <PreloadImages />
                    </WebsocketProvider>
                    <Toaster position='top-right' />
                </ThemeProvider>
            </body>
        </html>
    );
}
