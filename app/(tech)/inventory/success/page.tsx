import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default async function InventorySuccessPage({
  searchParams
}: {
  searchParams?: Promise<{ submission?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardTitle>Submission Complete</CardTitle>
        <CardDescription className="mt-1">
          Inventory was submitted successfully for this month.
        </CardDescription>
        <div className="mt-4 rounded-xl bg-brand-light p-3 text-sm text-brand-dark">
          Confirmation ID: {resolvedSearchParams?.submission ?? "Generated"}
        </div>
        <div className="mt-5 flex gap-3">
          <Link href="/inventory" className="flex-1">
            <Button className="w-full">Start New Entry</Button>
          </Link>
          <Link href="/submissions" className="flex-1">
            <Button variant="secondary" className="w-full">
              View My History
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
