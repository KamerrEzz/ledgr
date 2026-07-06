"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatCents, formatDate } from "@/lib/format";

interface LedgerEntry {
  id: string;
  orderId: string;
  entryType: string;
  amountCents: string;
  currency: string;
  description: string | null;
  createdAt: string;
}

interface LedgerResponse {
  entries: LedgerEntry[];
  total: number;
  page: number;
  limit: number;
}

interface LedgerSummary {
  credits: { count: number; totalCents: string };
  debits: { count: number; totalCents: string };
  net: string;
}

export default function LedgerPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch<LedgerResponse>(`/api/ledger?page=${page}&limit=${limit}`),
      apiFetch<LedgerSummary>("/api/ledger/summary"),
    ])
      .then(([res, sum]) => {
        setEntries(res.entries);
        setTotal(res.total);
        setSummary(sum);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  if (loading) return <div className="text-slate-500">Loading...</div>;

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Ledger</h2>
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <p className="text-sm text-slate-500">Total Credits ({summary.credits.count})</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{formatCents(summary.credits.totalCents)}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <p className="text-sm text-slate-500">Total Debits ({summary.debits.count})</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{formatCents(summary.debits.totalCents)}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <p className="text-sm text-slate-500">Net</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{formatCents(summary.net)}</p>
          </div>
        </div>
      )}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Order ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Description</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3 text-sm text-slate-900">{formatDate(entry.createdAt)}</td>
                  <td className="px-4 py-3 text-sm text-slate-900 font-mono">{entry.orderId.slice(0, 8)}...</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`font-medium ${entry.entryType === "credit" ? "text-green-600" : "text-red-600"}`}>
                      {entry.entryType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{formatCents(entry.amountCents)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{entry.description || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
            <span className="text-sm text-slate-500">
              Page {page} of {totalPages} ({total} total)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border border-slate-300 rounded-md disabled:opacity-50 hover:bg-slate-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm border border-slate-300 rounded-md disabled:opacity-50 hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
