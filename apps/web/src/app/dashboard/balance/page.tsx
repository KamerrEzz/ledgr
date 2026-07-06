"use client";

import { useEffect, useState } from "react";
import { useTenant } from "@/lib/tenant-context";
import { apiFetch } from "@/lib/api";
import { formatCents, formatDate } from "@/lib/format";

interface Balance {
  total_credits: string;
  total_debits: string;
  net_balance: string;
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

export default function BalancePage() {
  const { tenantId } = useTenant();
  const [balance, setBalance] = useState<Balance | null>(null);
  const [history, setHistory] = useState<BalanceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    Promise.all([
      apiFetch<Balance>("/api/balance", {}, tenantId),
      apiFetch<BalanceHistory>("/api/balance/history", {}, tenantId),
    ])
      .then(([bal, hist]) => {
        setBalance(bal);
        setHistory(hist.history);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [tenantId]);

  if (loading) return <div className="text-slate-500">Loading...</div>;

  const maxAmount = Math.max(
    ...history.map((h) => Math.max(Number(h.credits), Number(h.debits))),
    1
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Balance</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <p className="text-sm text-slate-500">Net Balance</p>
          <p className="text-3xl font-bold text-green-600 mt-1">
            {balance ? formatCents(balance.net_balance) : "$0.00"}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <p className="text-sm text-slate-500">Total Credits</p>
          <p className="text-3xl font-bold text-green-600 mt-1">
            {balance ? formatCents(balance.total_credits) : "$0.00"}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <p className="text-sm text-slate-500">Total Debits</p>
          <p className="text-3xl font-bold text-red-600 mt-1">
            {balance ? formatCents(balance.total_debits) : "$0.00"}
          </p>
        </div>
      </div>
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Balance History</h3>
        {history.length === 0 ? (
          <p className="text-slate-500 text-sm">No history yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Day</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Credits</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Debits</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Visual</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {history.map((entry, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 text-sm text-slate-900">
                      {formatDate(entry.day)}
                    </td>
                    <td className="px-4 py-3 text-sm text-green-600 font-medium">
                      {formatCents(entry.credits)}
                    </td>
                    <td className="px-4 py-3 text-sm text-red-600 font-medium">
                      {formatCents(entry.debits)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 h-4">
                        <div
                          className="bg-green-400 rounded"
                          style={{ width: `${(Number(entry.credits) / maxAmount) * 100}%` }}
                        />
                        <div
                          className="bg-red-400 rounded"
                          style={{ width: `${(Number(entry.debits) / maxAmount) * 100}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
