"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { PageHeaderUnderlineTabs } from "@/components/layout/PageHeaderUnderlineTabs";

/** Planner vs newsletter under the Get Clients → Content tab. */
export function ContentHubSubNav() {
  const pathname = usePathname() ?? "";
  const onNewsletter =
    pathname === "/admin/newsletter" ||
    pathname.startsWith("/admin/newsletter/");

  return (
    <div className="flex flex-col gap-2">
      <PageHeaderUnderlineTabs
        ariaLabel="Content tools"
        items={[
          {
            kind: "link",
            href: "/admin/linkedin",
            label: "Planner",
            active: !onNewsletter,
            scroll: false,
          },
          {
            kind: "link",
            href: "/admin/newsletter",
            label: "Newsletter",
            active: onNewsletter,
            scroll: false,
          },
        ]}
      />
      <Link
        href="/admin/message-generator"
        className="w-fit text-sm font-medium text-sky-800 hover:text-sky-950"
      >
        Need a draft? Open Create →
      </Link>
    </div>
  );
}
