import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VOIDAI // Enterprise Knowledge & Document Intelligence",
  description: "Enterprise Document Intelligence and Semantic Retrieval Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full bg-[#000000] text-[#E5E5E5] font-sans flex flex-col selection:bg-white selection:text-black">
        <ClerkProvider
          appearance={{
            theme: dark,
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
