import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { vendorApi } from "../../api/vendorApi.js";
import { useAuth } from "../../hooks/useAuth.js";

export default function ShopToggle() {
  const { user, setUser } = useAuth();
  const [error, setError] = useState(null);

  const mutation = useMutation({
    mutationFn: () => vendorApi.toggleShop(),
    onSuccess: (data) => {
      setError(null);
      if (user) setUser({ ...user, is_shop_open: data.is_shop_open });
    },
    onError: (err) => setError(err),
  });

  const open = Boolean(user?.is_shop_open);

  return (
    <div className="shop-toggle">
      {error && <span className="shop-toggle-error">{error.message}</span>}
      <button
        type="button"
        className={`switch${open ? " switch-on" : ""}`}
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        aria-pressed={open}
        aria-label={open ? "Close shop" : "Open shop"}
      >
        <span className="switch-knob" />
      </button>
      <span className={`shop-state ${open ? "shop-state-open" : "shop-state-closed"}`}>
        {open ? "Open" : "Closed"}
      </span>
    </div>
  );
}
