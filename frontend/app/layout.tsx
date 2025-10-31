import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GameProvider } from "@/context/roomContext";
import { WebsocketProvider } from "@/context/wsContext";
import "./globals.css";
import { Toaster } from "sonner";

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
                <GameProvider>
                    <WebsocketProvider>{children}</WebsocketProvider>
                </GameProvider>
                <Toaster position="top-right" />
            </body>
        </html>
    );
}
