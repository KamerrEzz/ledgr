"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatCents } from "@/lib/format";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";

interface Resource {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface Variant {
  id: string;
  resource_id: string;
  name: string;
  price_cents: string;
  currency: string;
  metadata: Record<string, unknown>;
}

export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [editResource, setEditResource] = useState<Resource | null>(null);
  const [editVariant, setEditVariant] = useState<Variant | null>(null);
  const [loading, setLoading] = useState(true);

  const [resourceForm, setResourceForm] = useState({ name: "", description: "" });
  const [variantForm, setVariantForm] = useState({ name: "", price_cents: "", currency: "USD" });

  const loadResources = () => {
    apiFetch<Resource[]>("/api/resources")
      .then(setResources)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const loadVariants = (resourceId: string) => {
    apiFetch<Variant[]>(`/api/resources/${resourceId}/variants`)
      .then(setVariants)
      .catch(console.error);
  };

  useEffect(() => {
    loadResources();
  }, []);

  const handleCreateResource = async () => {
    if (!resourceForm.name) return;
    await apiFetch<Resource>("/api/resources", {
      method: "POST",
      body: JSON.stringify(resourceForm),
    });
    setShowCreateModal(false);
    setResourceForm({ name: "", description: "" });
    loadResources();
  };

  const handleUpdateResource = async () => {
    if (!editResource) return;
    await apiFetch<Resource>(`/api/resources/${editResource.id}`, {
      method: "PATCH",
      body: JSON.stringify(resourceForm),
    });
    setEditResource(null);
    setResourceForm({ name: "", description: "" });
    loadResources();
    if (selectedResource?.id === editResource.id) {
      loadVariants(editResource.id);
    }
  };

  const handleDeleteResource = async (id: string) => {
    await apiFetch(`/api/resources/${id}`, { method: "DELETE" });
    if (selectedResource?.id === id) {
      setSelectedResource(null);
      setVariants([]);
    }
    loadResources();
  };

  const handleCreateVariant = async () => {
    if (!selectedResource || !variantForm.name || !variantForm.price_cents) return;
    await apiFetch<Variant>(`/api/resources/${selectedResource.id}/variants`, {
      method: "POST",
      body: JSON.stringify({
        name: variantForm.name,
        price_cents: parseInt(variantForm.price_cents, 10),
        currency: variantForm.currency,
      }),
    });
    setShowVariantModal(false);
    setVariantForm({ name: "", price_cents: "", currency: "USD" });
    loadVariants(selectedResource.id);
  };

  const handleUpdateVariant = async () => {
    if (!selectedResource || !editVariant) return;
    await apiFetch<Variant>(`/api/resources/${selectedResource.id}/variants/${editVariant.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: variantForm.name,
        price_cents: parseInt(variantForm.price_cents, 10),
        currency: variantForm.currency,
      }),
    });
    setEditVariant(null);
    setVariantForm({ name: "", price_cents: "", currency: "USD" });
    loadVariants(selectedResource.id);
  };

  const handleDeleteVariant = async (variantId: string) => {
    if (!selectedResource) return;
    await apiFetch(`/api/resources/${selectedResource.id}/variants/${variantId}`, {
      method: "DELETE",
    });
    loadVariants(selectedResource.id);
  };

  const resourceColumns = [
    { key: "name", header: "Name" },
    { key: "description", header: "Description", render: (item: Resource) => item.description || "-" },
    { key: "is_active", header: "Active", render: (item: Resource) => (
      <span className={item.is_active ? "text-green-600" : "text-red-600"}>
        {item.is_active ? "Yes" : "No"}
      </span>
    )},
    { key: "actions", header: "Actions", render: (item: Resource) => (
      <div className="flex gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); setEditResource(item); setResourceForm({ name: item.name, description: item.description || "" }); }}
          className="text-sm text-blue-600 hover:underline"
        >
          Edit
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleDeleteResource(item.id); }}
          className="text-sm text-red-600 hover:underline"
        >
          Delete
        </button>
      </div>
    )},
  ];

  const variantColumns = [
    { key: "name", header: "Name" },
    { key: "price_cents", header: "Price", render: (item: Variant) => formatCents(item.price_cents) },
    { key: "currency", header: "Currency" },
    { key: "actions", header: "Actions", render: (item: Variant) => (
      <div className="flex gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); setEditVariant(item); setVariantForm({ name: item.name, price_cents: String(Number(item.price_cents) / 100), currency: item.currency }); }}
          className="text-sm text-blue-600 hover:underline"
        >
          Edit
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleDeleteVariant(item.id); }}
          className="text-sm text-red-600 hover:underline"
        >
          Delete
        </button>
      </div>
    )},
  ];

  if (loading) return <div className="text-slate-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Resources</h2>
        <button
          onClick={() => { setResourceForm({ name: "", description: "" }); setShowCreateModal(true); }}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
        >
          Create Resource
        </button>
      </div>
      <div className="bg-white rounded-lg border border-slate-200">
        <DataTable
          columns={resourceColumns}
          data={resources}
          onRowClick={(r) => {
            setSelectedResource(r);
            loadVariants(r.id);
          }}
        />
      </div>
      {selectedResource && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">
              Variants — {selectedResource.name}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => { setVariantForm({ name: "", price_cents: "", currency: "USD" }); setShowVariantModal(true); }}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
              >
                Create Variant
              </button>
              <button
                onClick={() => { setSelectedResource(null); setVariants([]); }}
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                Close
              </button>
            </div>
          </div>
          <DataTable
            columns={variantColumns}
            data={variants}
          />
        </div>
      )}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Resource"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              type="text"
              value={resourceForm.name}
              onChange={(e) => setResourceForm({ ...resourceForm, name: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <input
              type="text"
              value={resourceForm.description}
              onChange={(e) => setResourceForm({ ...resourceForm, description: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={handleCreateResource}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            Create
          </button>
        </div>
      </Modal>
      <Modal
        isOpen={!!editResource}
        onClose={() => setEditResource(null)}
        title="Edit Resource"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              type="text"
              value={resourceForm.name}
              onChange={(e) => setResourceForm({ ...resourceForm, name: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <input
              type="text"
              value={resourceForm.description}
              onChange={(e) => setResourceForm({ ...resourceForm, description: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={handleUpdateResource}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            Update
          </button>
        </div>
      </Modal>
      <Modal
        isOpen={showVariantModal}
        onClose={() => setShowVariantModal(false)}
        title="Create Variant"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              type="text"
              value={variantForm.name}
              onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Price (dollars)</label>
            <input
              type="number"
              step="0.01"
              value={variantForm.price_cents}
              onChange={(e) => setVariantForm({ ...variantForm, price_cents: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
            <input
              type="text"
              value={variantForm.currency}
              onChange={(e) => setVariantForm({ ...variantForm, currency: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={handleCreateVariant}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            Create
          </button>
        </div>
      </Modal>
      <Modal
        isOpen={!!editVariant}
        onClose={() => setEditVariant(null)}
        title="Edit Variant"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              type="text"
              value={variantForm.name}
              onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Price (dollars)</label>
            <input
              type="number"
              step="0.01"
              value={variantForm.price_cents}
              onChange={(e) => setVariantForm({ ...variantForm, price_cents: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
            <input
              type="text"
              value={variantForm.currency}
              onChange={(e) => setVariantForm({ ...variantForm, currency: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={handleUpdateVariant}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            Update
          </button>
        </div>
      </Modal>
    </div>
  );
}
