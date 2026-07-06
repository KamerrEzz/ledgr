export function formatCents(cents: number | string): string {
  const amount = typeof cents === "string" ? parseFloat(cents) : cents;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount / 100);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function statusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: "bg-slate-100 text-slate-800",
    pending_payment: "bg-yellow-100 text-yellow-800",
    paid: "bg-green-100 text-green-800",
    fulfilled: "bg-blue-100 text-blue-800",
    failed: "bg-red-100 text-red-800",
    refunded: "bg-orange-100 text-orange-800",
    received: "bg-slate-100 text-slate-800",
    processing: "bg-yellow-100 text-yellow-800",
    processed: "bg-green-100 text-green-800",
    duplicate: "bg-orange-100 text-orange-800",
  };
  return colors[status] || "bg-slate-100 text-slate-800";
}
