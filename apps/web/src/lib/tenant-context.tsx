"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./auth-context";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
}

const TENANTS: Tenant[] = [
  { id: "a0000000-0000-4000-8000-000000000001", name: "Acme Corp", slug: "acme" },
  { id: "a0000000-0000-4000-8000-000000000002", name: "Globex Inc", slug: "globex" },
  { id: "a0000000-0000-4000-8000-000000000003", name: "Initech", slug: "initech" },
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
  const { user } = useAuth();
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.tenant_id) {
      setTenantId(user.tenant_id);
    }
  }, [user]);

  return (
    <TenantContext.Provider value={{ tenantId, setTenantId, tenants: TENANTS }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
