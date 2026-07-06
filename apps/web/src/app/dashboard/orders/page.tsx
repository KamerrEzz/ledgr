"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatCents, formatDate } from "@/lib/format";
import DataTable from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import Modal from "@/components/Modal";

interface Order {
  id: string;
  resourceVariantId: string;
  quantity: number;
  totalCents: string;
  currency: string;
  status: string;
  createdAt: string;
  transitions?: Transition[];
}

interface Transition {
  id: string;
  fromStatus: string;
  toStatus: string;
  reason: string | null;
  createdAt: string;
}

interface Variant {
  id: string;
  name: string;
  priceCents: string;
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["pending_payment"],
  pending_payment: ["paid", "failed"],
  paid: ["fulfilled", "refunded"],
  fulfilled: [],
  failed: [],
  refunded: [],
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [variants, setVariants] = useState<Variant[]>([]);

  const [createForm, setCreateForm] = useState({ variant_id: "", quantity: "1" });
  const [transitionTo, setTransitionTo] = useState("");

  const loadOrders = () => {
    apiFetch<Order[]>("/api/orders")
      .then(setOrders)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const loadVariants = () => {
    apiFetch<Variant[]>("/api/resources").then((resources) => {
      const allVariants: Variant[] = [];
      const promises = resources.map((r: { id: string }) =>
        apiFetch<Variant[]>(`/api/resources/${r.id}/variants`).then((v) => {
          allVariants.push(...v);
        })
      );
      Promise.all(promises).then(() => setVariants(allVariants));
    });
  };

  useEffect(() => {
    loadOrders();
    loadVariants();
  }, []);

  const handleCreateOrder = async () => {
    if (!createForm.variant_id) return;
    await apiFetch<Order>("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        resource_variant_id: createForm.variant_id,
        quantity: parseInt(createForm.quantity, 10),
      }),
    });
    setShowCreateModal(false);
    setCreateForm({ variant_id: "", quantity: "1" });
    loadOrders();
  };

  const handleTransition = async () => {
    if (!selectedOrder || !transitionTo) return;
    await apiFetch<Order>(`/api/orders/${selectedOrder.id}/transition`, {
      method: "POST",
      body: JSON.stringify({ to_status: transitionTo }),
    });
    setShowTransitionModal(false);
    setTransitionTo("");
    const updated = await apiFetch<Order>(`/api/orders/${selectedOrder.id}`);
    setSelectedOrder(updated);
    loadOrders();
  };

  const handleViewOrder = async (order: Order) => {
    const detailed = await apiFetch<Order>(`/api/orders/${order.id}`);
    setSelectedOrder(detailed);
  };

  const getVariantName = (variantId: string | undefined) => {
    if (!variantId) return "—";
    const v = variants.find((v) => v.id === variantId);
    return v?.name || variantId.slice(0, 8);
  };

  const orderColumns = [
    { key: "id", header: "ID", render: (item: Order) => item.id.slice(0, 8) + "..." },
    { key: "resourceVariantId", header: "Variant", render: (item: Order) => getVariantName(item.resourceVariantId) },
    { key: "quantity", header: "Qty" },
    { key: "totalCents", header: "Total", render: (item: Order) => formatCents(item.totalCents) },
    { key: "status", header: "Status", render: (item: Order) => <StatusBadge status={item.status} /> },
    { key: "createdAt", header: "Created", render: (item: Order) => formatDate(item.createdAt) },
  ];

  if (loading) return <div className="text-slate-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Orders</h2>
        <button
          onClick={() => { setCreateForm({ variant_id: "", quantity: "1" }); setShowCreateModal(true); }}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
        >
          Create Order
        </button>
      </div>
      <div className="bg-white rounded-lg border border-slate-200">
        <DataTable
          columns={orderColumns}
          data={orders}
          onRowClick={(item) => handleViewOrder(item)}
        />
      </div>
      {selectedOrder && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">
              Order {selectedOrder.id.slice(0, 8)}...
            </h3>
            <div className="flex gap-2">
              {VALID_TRANSITIONS[selectedOrder.status]?.length > 0 && (
                <button
                  onClick={() => { setTransitionTo(""); setShowTransitionModal(true); }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  Transition
                </button>
              )}
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                Close
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
            <div>
              <span className="text-slate-500">Status</span>
              <div><StatusBadge status={selectedOrder.status} /></div>
            </div>
            <div>
              <span className="text-slate-500">Total</span>
              <div className="font-medium">{formatCents(selectedOrder.totalCents)}</div>
            </div>
            <div>
              <span className="text-slate-500">Quantity</span>
              <div className="font-medium">{selectedOrder.quantity}</div>
            </div>
            <div>
              <span className="text-slate-500">Created</span>
              <div className="font-medium">{formatDate(selectedOrder.createdAt)}</div>
            </div>
          </div>
          {selectedOrder.transitions && selectedOrder.transitions.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Status History</h4>
              <div className="space-y-2">
                {selectedOrder.transitions.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 text-sm">
                    <span className="text-slate-500">{formatDate(t.createdAt)}</span>
                    <span className="text-slate-700">
                      {t.fromStatus} → {t.toStatus}
                    </span>
                    {t.reason && <span className="text-slate-400">({t.reason})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Order"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Variant</label>
            <select
              value={createForm.variant_id}
              onChange={(e) => setCreateForm({ ...createForm, variant_id: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Select a variant</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} — {formatCents(v.priceCents)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
            <input
              type="number"
              min="1"
              value={createForm.quantity}
              onChange={(e) => setCreateForm({ ...createForm, quantity: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={handleCreateOrder}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            Create
          </button>
        </div>
      </Modal>
      <Modal
        isOpen={showTransitionModal}
        onClose={() => setShowTransitionModal(false)}
        title="Transition Order"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New Status</label>
            <select
              value={transitionTo}
              onChange={(e) => setTransitionTo(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Select status</option>
              {VALID_TRANSITIONS[selectedOrder?.status || ""]?.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleTransition}
            disabled={!transitionTo}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            Transition
          </button>
        </div>
      </Modal>
    </div>
  );
}
