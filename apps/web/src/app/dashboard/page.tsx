"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatCents, formatDate, statusColor } from "@/lib/format";

interface Resource {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

interface Order {
  id: string;
  status: string;
  totalCents: string;
  quantity: number;
  createdAt: string;
  resourceVariantId: string;
}

interface Balance {
  totalCredits: string;
  totalDebits: string;
  netBalance: string;
  currency: string;
}

interface BalanceHistoryEntry {
  day: string;
  credits: string;
  debits: string;
}

interface BalanceHistory {
  history: BalanceHistoryEntry[];
}

export default function DashboardPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [balanceHistory, setBalanceHistory] = useState<BalanceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch<Resource[]>("/api/resources"),
      apiFetch<Order[]>("/api/orders"),
      apiFetch<Balance>("/api/balance"),
      apiFetch<BalanceHistory>("/api/balance/history"),
    ])
      .then(([res, ord, bal, hist]) => {
        setResources(res);
        setOrders(ord);
        setBalance(bal);
        setBalanceHistory(hist.history);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-slate-500">Loading...</div>;
  }

  const recentOrders = orders.slice(0, 5);
  const maxAmount = Math.max(
    ...balanceHistory.map((h) => Math.max(Number(h.credits), Number(h.debits))),
    1
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <p className="text-sm text-slate-500">Total Resources</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{resources.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <p className="text-sm text-slate-500">Total Orders</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{orders.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <p className="text-sm text-slate-500">Current Balance</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">
            {balance ? formatCents(balance.netBalance) : "$0.00"}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Orders</h3>
          {recentOrders.length === 0 ? (
            <p className="text-slate-500 text-sm">No orders yet.</p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {order.id.slice(0, 8)}...
                    </p>
                    <p className="text-xs text-slate-500">{formatDate(order.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-900">{formatCents(order.totalCents)}</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(order.status)}`}>
                      {order.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Balance History</h3>
          {balanceHistory.length === 0 ? (
            <p className="text-slate-500 text-sm">No history yet.</p>
          ) : (
            <div className="space-y-2">
              {balanceHistory.slice(0, 7).map((entry, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <span className="text-xs text-slate-500 w-20 shrink-0">
                    {new Date(entry.day).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden flex">
                      <div
                        className="h-full bg-green-400"
                        style={{ width: `${(Number(entry.credits) / maxAmount) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-green-600 w-16 text-right">{formatCents(entry.credits)}</span>
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden flex">
                      <div
                        className="h-full bg-red-400"
                        style={{ width: `${(Number(entry.debits) / maxAmount) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-red-600 w-16 text-right">{formatCents(entry.debits)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
