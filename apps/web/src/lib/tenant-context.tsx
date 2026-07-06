"use client";

import { createContext, useContext, useState } from "react";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
}

const TENANTS: Tenant[] = [
  { id: "a0000000-0000-0000-0000-000000000001", name: "Acme Corp", slug: "acme" },
  { id: "a0000000-0000-0000-0000-000000000002", name: "Globex Inc", slug: "globex" },
  { id: "a0000000-0000-0000-0000-000000000003", name: "Initech", slug: "initech" },
];

interface TenantContextValue {
  tenantId: string | null;
  setTenantId: (id: string) => void;
  tenants: Tenant[];
}

const TenantContext = createContext<TenantContextValue>({
  tenantId: null,
  setTenantId: () => {},
  tenants: TENANTS,
});

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenantId, setTenantId] = useState<string | null>(null);

  return (
    <TenantContext.Provider value={{ tenantId, setTenantId, tenants: TENANTS }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
