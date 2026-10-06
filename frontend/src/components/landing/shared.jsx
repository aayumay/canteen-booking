import React from "react";
import {
  DoodleBrandMark,
  DoodleClock,
  DoodleDabba,
  DoodleCap,
  DoodlePin,
  DoodleShield,
  DoodleWallet,
} from "../common/doodles.jsx";

/** Icons used by the feature bento, keyed to the manifest in landingImages. */
export const FEATURE_ICONS = {
  clock: DoodleClock,
  wallet: DoodleWallet,
  shield: DoodleShield,
  cap: DoodleCap,
  dabba: DoodleDabba,
  pin: DoodlePin,
};

/** The brand mark, reused in the nav, the footer and the app shell. */
export function Wordmark({ tone = "forest" }) {
  return (
    <span className={`lp-wordmark lp-wordmark-${tone}`}>
      <DoodleBrandMark size={30} className="lp-wordmark-glyph" />
      <span className="lp-wordmark-text">
        Canteen<span className="lp-wordmark-accent">Booking</span>
      </span>
    </span>
  );
}

/** Smooth-scrolls to a hash link and closes the mobile drawer if open. */
export function hashLinkHandler(setOpen) {
  return (e) => {
    const href = e.currentTarget.getAttribute("href");
    if (!href || !href.startsWith("#")) return;
    const target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    if (setOpen) setOpen(false);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    // Keep the URL shareable without a jump.
    window.history.replaceState(null, "", href);
  };
}

export { React };
