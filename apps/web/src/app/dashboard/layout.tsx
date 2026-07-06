"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTenant } from "@/lib/tenant-context";
import { useAuth } from "@/lib/auth-context";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/resources", label: "Resources" },
  { href: "/dashboard/orders", label: "Orders" },
  { href: "/dashboard/balance", label: "Balance" },
  { href: "/dashboard/ledger", label: "Ledger" },
  { href: "/dashboard/webhooks", label: "Webhooks" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { tenants, tenantId } = useTenant();
  const { user, logout } = useAuth();

  const currentTenant = tenants.find((t) => t.id === tenantId);

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex">
        <aside className="w-64 bg-slate-900 text-white flex flex-col">
          <div className="p-4 border-b border-slate-700">
            <Link href="/dashboard" className="text-xl font-bold">
              Ledgr
            </Link>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? "bg-slate-700 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">
                {currentTenant?.name}
              </h1>
              {user && (
                <p className="text-xs text-slate-500">{user.email}</p>
              )}
            </div>
            <button
              onClick={() => logout()}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Sign out
            </button>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
