import Image from "next/image";
import Link from "next/link";

import { signOutAction } from "@/lib/actions/auth-actions";
import { requireAdmin } from "@/lib/auth-helpers";
import { getBrandingConfig } from "@/lib/branding";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/submissions", label: "Submissions" },
  { href: "/admin/settings", label: "Settings" }
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const branding = await getBrandingConfig();

  return (
    <div className="min-h-screen pb-12">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin" className="flex items-center gap-3">
            <Image src={branding.logoPath} alt={branding.companyName} width={120} height={38} className="h-8 w-auto" />
            <span className="text-sm font-semibold text-brand-dark">Admin Dashboard</span>
          </Link>
          <nav className="flex items-center gap-3">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm font-medium text-gray-700 hover:text-brand-dark">
                {item.label}
              </Link>
            ))}
          </nav>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out ({user.name})
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pt-5 sm:px-6">{children}</main>
    </div>
  );
}
