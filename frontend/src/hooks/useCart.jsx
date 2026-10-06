import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const CART_STORAGE_KEY = "canteen.cart.v1";

const CartContext = createContext(null);

const EMPTY_CART = { vendorId: null, vendorName: null, lines: [] };

function loadCart() {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return EMPTY_CART;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.lines)) return EMPTY_CART;
    return {
      vendorId: parsed.vendorId ?? null,
      vendorName: parsed.vendorName ?? null,
      lines: parsed.lines.filter((l) => l?.menuItem?.id != null && l.quantity > 0),
    };
  } catch {
    return EMPTY_CART;
  }
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(loadCart);

  useEffect(() => {
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Storage unavailable — cart simply won't survive a reload.
    }
  }, [cart]);

  /**
   * Add an item, enforcing the one-vendor-per-cart rule. Switching vendors
   * clears the cart, but only after the student confirms. Returns whether the
   * item was actually added (false = user cancelled the switch).
   */
  const addItem = useCallback(
    (menuItem, vendor) => {
      if (cart.vendorId && cart.vendorId !== vendor.id) {
        const confirmed = window.confirm(
          `Your cart currently has items from ${cart.vendorName ?? "another canteen"}.\n\n` +
            `Starting an order from ${vendor.shop_name} will clear that cart. Continue?`
        );
        if (!confirmed) return false;
        setCart({ vendorId: vendor.id, vendorName: vendor.shop_name, lines: [{ menuItem, quantity: 1 }] });
        return true;
      }

      setCart((prev) => {
        const effectiveVendorId = prev.vendorId ?? vendor.id;
        const existing = prev.lines.find((l) => l.menuItem.id === menuItem.id);
        const lines = existing
          ? prev.lines.map((l) =>
              l.menuItem.id === menuItem.id ? { ...l, quantity: l.quantity + 1 } : l
            )
          : [...prev.lines, { menuItem, quantity: 1 }];
        return { vendorId: effectiveVendorId, vendorName: vendor.shop_name ?? prev.vendorName, lines };
      });
      return true;
    },
    [cart.vendorId, cart.vendorName]
  );

  const setQuantity = useCallback((menuItemId, quantity) => {
    setCart((prev) => {
      if (quantity <= 0) {
        const lines = prev.lines.filter((l) => l.menuItem.id !== menuItemId);
        return lines.length === 0 ? EMPTY_CART : { ...prev, lines };
      }
      return {
        ...prev,
        lines: prev.lines.map((l) =>
          l.menuItem.id === menuItemId ? { ...l, quantity } : l
        ),
      };
    });
  }, []);

  const increment = useCallback(
    (menuItemId) => {
      setCart((prev) => ({
        ...prev,
        lines: prev.lines.map((l) =>
          l.menuItem.id === menuItemId ? { ...l, quantity: l.quantity + 1 } : l
        ),
      }));
    },
    []
  );

  const decrement = useCallback((menuItemId) => {
    setCart((prev) => {
      const lines = prev.lines
        .map((l) => (l.menuItem.id === menuItemId ? { ...l, quantity: l.quantity - 1 } : l))
        .filter((l) => l.quantity > 0);
      return lines.length === 0 ? EMPTY_CART : { ...prev, lines };
    });
  }, []);

  const clearCart = useCallback(() => setCart(EMPTY_CART), []);

  const value = useMemo(() => {
    const count = cart.lines.reduce((sum, l) => sum + l.quantity, 0);
    // DISPLAY ONLY: the server recomputes every rupee from live menu prices
    // when the order is placed. `subtotal` must never be sent anywhere.
    const subtotal = cart.lines.reduce(
      (sum, l) => sum + Number(l.menuItem.price ?? 0) * l.quantity,
      0
    );
    const items = cart.lines.map((l) => ({
      ...l.menuItem,
      quantity: l.quantity,
    }));

    return {
      vendorId: cart.vendorId,
      vendorName: cart.vendorName,
      lines: cart.lines,
      items,
      count,
      totalItems: count,
      subtotal,
      addItem,
      setQuantity,
      increment,
      decrement,
      removeItem: (menuItemId) => setQuantity(menuItemId, 0),
      clear: clearCart,
      clearCart,
      quantityOf: (menuItemId) =>
        cart.lines.find((l) => l.menuItem.id === menuItemId)?.quantity ?? 0,
      hasDifferentVendor: (vendorId) =>
        Boolean(cart.vendorId && cart.vendorId !== vendorId),
    };
  }, [cart, addItem, setQuantity, increment, decrement, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a <CartProvider>.");
  }
  return ctx;
}
