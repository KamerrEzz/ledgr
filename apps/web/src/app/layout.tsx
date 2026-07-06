import type { Metadata } from "next";
import { TenantProvider } from "@/lib/tenant-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ledgr Dashboard",
  description: "Multi-tenant SaaS marketplace dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <TenantProvider>{children}</TenantProvider>
      </body>
    </html>
  );
}
