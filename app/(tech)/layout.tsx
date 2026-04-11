import Image from "next/image";
import Link from "next/link";

import { signOutAction } from "@/lib/actions/auth-actions";
import { requireTechnician } from "@/lib/auth-helpers";
import { getBrandingConfig } from "@/lib/branding";
import { Button } from "@/components/ui/button";

export default async function TechnicianLayout({ children }: { children: React.ReactNode }) {
  const user = await requireTechnician();
  const branding = await getBrandingConfig();

  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/inventory" className="flex items-center gap-3">
            <Image src={branding.logoPath} alt={branding.companyName} width={120} height={38} className="h-8 w-auto" />
            <span className="hidden text-sm font-medium text-gray-600 sm:block">Technician Portal</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/submissions" className="text-sm font-medium text-gray-700 hover:text-brand-dark">
              My Submissions
            </Link>
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out ({user.name})
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 pt-5 sm:px-6">{children}</main>
    </div>
  );
}
