import Image from "next/image";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getBrandingConfig } from "@/lib/branding";
import { LoginPanels } from "@/components/auth/login-panels";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    if (session.user.role === "ADMIN") {
      redirect("/admin");
    }
    redirect("/inventory");
  }

  const branding = await getBrandingConfig();

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-md space-y-6">
        <div className="rounded-2xl bg-white p-6 text-center shadow-card">
          <div className="mx-auto mb-3 flex justify-center">
            <Image
              src={branding.logoPath}
              alt={branding.companyName}
              width={210}
              height={66}
              className="h-auto w-[210px]"
              priority
            />
          </div>
          <h1 className="text-2xl font-semibold text-brand-dark">{branding.appTitle}</h1>
          <p className="mt-2 text-sm text-gray-600">
            Monthly inventory workflow for truck and office/shop counts.
          </p>
        </div>

        <LoginPanels />
      </div>
    </main>
  );
}
