import React from "react";
import {
  DoodleSprig,
  DoodleSquiggle,
  DoodleSparkle,
  DoodleActionLines,
  DoodlePlate,
  DoodleSamosa,
  DoodleLeaf,
  DoodleSteam,
} from "./doodles.jsx";

/**
 * Ambient hand-drawn art layer.
 *
 * Rendered as a fixed, non-interactive, CSS-animated layer so it costs one
 * composited paint rather than re-running JS on every render. Every mark
 * inherits the palette through `currentColor`, and all drift animation is
 * disabled automatically when the OS asks for reduced motion.
 *
 * @param {"soft"|"lively"} density  "soft" is the default in-app treatment
 */
export default function DecorativeDoodles({ density = "soft" }) {
  const lively = density === "lively";

  return (
    <div className="doodle-layer" aria-hidden="true">
      <div className="doodle-layer-dotgrid" />

      <DoodleLeaf className="doodle-mark doodle-a" />
      <DoodleSquiggle className="doodle-mark doodle-b" />
      <DoodleSparkle className="doodle-mark doodle-c" />
      <DoodleActionLines className="doodle-mark doodle-d" />
      <DoodlePlate className="doodle-mark doodle-e" />
      <DoodleSamosa className="doodle-mark doodle-f" />
      <DoodleSprig className={`doodle-mark doodle-g ${lively ? "doodle-drift" : ""}`} />
      <DoodleSteam className="doodle-mark doodle-h" />
    </div>
  );
}
