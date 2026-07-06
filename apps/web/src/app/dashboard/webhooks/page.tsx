"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";

interface WebhookEvent {
  id: string;
  source: string;
  event_type: string;
  status: string;
  payload: unknown;
  created_at: string;
  processed_at: string | null;
  error_message: string | null;
}

export default function WebhooksPage() {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<WebhookEvent[]>("/api/webhooks")
      .then(setEvents)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleViewEvent = async (event: WebhookEvent) => {
    const detailed = await apiFetch<WebhookEvent>(`/api/webhooks/${event.id}`);
    setSelectedEvent(detailed);
  };

  if (loading) return <div className="text-slate-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Webhooks</h2>
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Source</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Event Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">ID</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {events.map((event) => (
                <tr
                  key={event.id}
                  onClick={() => handleViewEvent(event)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="px-4 py-3 text-sm text-slate-900">{formatDate(event.created_at)}</td>
                  <td className="px-4 py-3 text-sm text-slate-900">{event.source}</td>
                  <td className="px-4 py-3 text-sm text-slate-900">{event.event_type}</td>
                  <td className="px-4 py-3 text-sm"><StatusBadge status={event.status} /></td>
                  <td className="px-4 py-3 text-sm text-slate-500 font-mono">{event.id.slice(0, 8)}...</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selectedEvent && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">
              Webhook Event {selectedEvent.id.slice(0, 8)}...
            </h3>
            <button
              onClick={() => setSelectedEvent(null)}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
            <div>
              <span className="text-slate-500">Source</span>
              <div className="font-medium">{selectedEvent.source}</div>
            </div>
            <div>
              <span className="text-slate-500">Event Type</span>
              <div className="font-medium">{selectedEvent.event_type}</div>
            </div>
            <div>
              <span className="text-slate-500">Status</span>
              <div><StatusBadge status={selectedEvent.status} /></div>
            </div>
            <div>
              <span className="text-slate-500">Created</span>
              <div className="font-medium">{formatDate(selectedEvent.created_at)}</div>
            </div>
          </div>
          {selectedEvent.error_message && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {selectedEvent.error_message}
            </div>
          )}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Payload</h4>
            <pre className="bg-slate-50 border border-slate-200 rounded-md p-4 text-sm text-slate-800 overflow-x-auto">
              {JSON.stringify(selectedEvent.payload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
