import { db } from "@/lib/db";

export type BrandingView = {
  companyName: string;
  appTitle: string;
  logoPath: string;
  faviconPath: string;
  primaryColor: string;
  accentColor: string;
  textColor: string;
  photosRequired: boolean;
};

export const defaultBranding: BrandingView = {
  companyName: "Pure Pest Solutions",
  appTitle: "Pure Pest Inventory",
  logoPath: "/branding/logo.png",
  faviconPath: "/branding/favicon.ico",
  primaryColor: "#97C972",
  accentColor: "#D3FDD7",
  textColor: "#434343",
  photosRequired: false
};

export async function getBrandingConfig(): Promise<BrandingView> {
  try {
    const branding = await db.brandingConfig.findUnique({
      where: { id: "default" }
    });

    if (!branding) {
      return defaultBranding;
    }

    return {
      companyName: branding.companyName,
      appTitle: branding.appTitle,
      logoPath: branding.logoPath,
      faviconPath: branding.faviconPath,
      primaryColor: branding.primaryColor,
      accentColor: branding.accentColor,
      textColor: branding.textColor,
      photosRequired: branding.photosRequired
    };
  } catch {
    return defaultBranding;
  }
}
