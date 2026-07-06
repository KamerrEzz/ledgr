"use client";

import { useTenant } from "@/lib/tenant-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { tenantId, setTenantId, tenants } = useTenant();
  const router = useRouter();

  useEffect(() => {
    if (tenantId) {
      router.push("/dashboard");
    }
  }, [tenantId, router]);

  if (tenantId) return null;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold text-slate-900 mb-2">Ledgr</h1>
      <p className="text-slate-600 mb-12">Select a workspace to continue</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl w-full">
        {tenants.map((tenant) => (
          <button
            key={tenant.id}
            onClick={() => setTenantId(tenant.id)}
            className="bg-white rounded-lg border border-slate-200 p-6 text-left hover:border-blue-500 hover:shadow-md transition-all"
          >
            <h2 className="text-xl font-semibold text-slate-900">{tenant.name}</h2>
            <p className="text-sm text-slate-500 mt-1">{tenant.slug}</p>
          </button>
        ))}
      </div>
    </main>
  );
}
