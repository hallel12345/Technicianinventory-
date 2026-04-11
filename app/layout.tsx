import type { Metadata } from "next";
import { Montserrat } from "next/font/google";

import "@/app/globals.css";
import { getBrandingConfig } from "@/lib/branding";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat"
});

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBrandingConfig();
  return {
    title: branding.appTitle,
    description: "Monthly truck and office inventory workflow for Pure Pest Solutions.",
    icons: {
      icon: branding.faviconPath
    }
  };
}

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const branding = await getBrandingConfig();

  return (
    <html lang="en" className={montserrat.variable}>
      <body
        className="font-sans"
        style={
          {
            "--brand-primary": branding.primaryColor,
            "--brand-accent": branding.accentColor,
            "--brand-text": branding.textColor
          } as React.CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
