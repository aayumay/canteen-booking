import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { vendorApi } from "../../api/vendorApi.js";
import { formatMoney } from "../../lib/format.js";
import ErrorState from "../common/ErrorState.jsx";
import EmptyState from "../common/EmptyState.jsx";
import { Spinner } from "../common/Spinner.jsx";
import MenuItemForm from "./MenuItemForm.jsx";

export default function MenuManager() {
  const queryClient = useQueryClient();
  const menuQuery = useQuery({
    queryKey: ["vendorMenu", "me"],
    queryFn: vendorApi.listMyMenu,
  });

  const [editing, setEditing] = useState(null); // null | "new" | item
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [rowError, setRowError] = useState(null);

  const invalidateMenu = () => {
    // Covers both the vendor's own list and any cached student menus,
    // so availability changes are reflected everywhere.
    queryClient.invalidateQueries({ queryKey: ["vendorMenu"] });
  };

  const availabilityMutation = useMutation({
    mutationFn: ({ id, is_available }) => vendorApi.updateMenuItem(id, { is_available }),
    onSuccess: () => {
      setRowError(null);
      invalidateMenu();
    },
    onError: (err) => setRowError(err),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => vendorApi.deleteMenuItem(id),
    onSuccess: () => {
      setRowError(null);
      setConfirmDeleteId(null);
      invalidateMenu();
    },
    onError: (err) => setRowError(err),
  });

  if (menuQuery.isLoading) {
    return (
      <div className="center-row">
        <Spinner size="lg" label="Loading menu" />
      </div>
    );
  }

  if (menuQuery.isError) {
    return <ErrorState error={menuQuery.error} onRetry={() => menuQuery.refetch()} />;
  }

  const items = menuQuery.data ?? [];

  return (
    <div className="menu-manager">
      <div className="section-head">
        <h2 className="section-title">Your menu</h2>
        <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
          Add item
        </button>
      </div>

      {rowError && (
        <div className="form-error" role="alert">
          {rowError.message}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="No menu items yet"
          hint="Add your first item so students can start ordering."
          action={
            <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
              Add item
            </button>
          }
        />
      ) : (
        <ul className="menu-manage-list">
          {items.map((item) => (
            <li key={item.id} className={`menu-manage-row${item.is_available ? "" : " menu-row-unavailable"}`}>
              <div className="menu-manage-main">
                <span className="menu-manage-name">{item.name}</span>
                {item.category && <span className="chip">{item.category}</span>}
                {item.description && <p className="menu-manage-desc dim">{item.description}</p>}
              </div>
              <span className="menu-manage-price mono">{formatMoney(item.price)}</span>
              <button
                type="button"
                className={`switch switch-sm${item.is_available ? " switch-on" : ""}`}
                onClick={() =>
                  availabilityMutation.mutate({ id: item.id, is_available: !item.is_available })
                }
                disabled={availabilityMutation.isPending}
                aria-pressed={item.is_available}
                aria-label={`${item.is_available ? "Mark unavailable" : "Mark available"}: ${item.name}`}
              >
                <span className="switch-knob" />
              </button>
              <span className="menu-manage-avail dim">{item.is_available ? "Available" : "Hidden"}</span>
              <div className="menu-manage-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(item)}>
                  Edit
                </button>
                {confirmDeleteId === item.id ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => deleteMutation.mutate(item.id)}
                      disabled={deleteMutation.isPending}
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      Keep
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn-danger-ghost btn-sm"
                    onClick={() => setConfirmDeleteId(item.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <MenuItemForm
          item={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
