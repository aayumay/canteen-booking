import React from "react";
import { Link } from "react-router-dom";
import "./scrapbook/scrapbook.css";
import FloatingNav from "./scrapbook/sections/FloatingNav.jsx";
import Hero from "./scrapbook/sections/Hero.jsx";
import PolaroidCluster from "./scrapbook/sections/PolaroidCluster.jsx";
import WavyJourney from "./scrapbook/sections/WavyJourney.jsx";
import IngredientScatter from "./scrapbook/sections/IngredientScatter.jsx";
import ComparisonTable from "./scrapbook/sections/ComparisonTable.jsx";
import ScrapbookFooter from "./scrapbook/sections/ScrapbookFooter.jsx";

/*
 * Scrapbook layout study.
 *
 * This is a separate route on purpose: /landing is the page we tuned and
 * verified this session and nothing here should be able to regress it. The
 * stylesheet is imported from this module so Vite code-splits it, and it opts
 * out of Tailwind's preflight and auto-scanning (see scrapbook.css) so the
 * utilities cannot leak into the rest of the SPA.
 *
 * The social-proof, stats and comparison content is PLACEHOLDER — there is no
 * review or order data in the database to draw on. See scrapbook/data.js.
 */
export default function Scrapbook() {
  return (
    <div className="min-h-screen bg-sage text-ink">
      <FloatingNav />
      <main>
        <Hero />
        <PolaroidCluster />
        <WavyJourney />
        <IngredientScatter />
        <ComparisonTable />
      </main>
      <ScrapbookFooter />

      {/* Escape hatch back to the real landing page. */}
      <div className="bg-sage px-4 pb-8 text-center">
        <Link
          to="/landing"
          className="inline-block border-[3px] border-white bg-white px-5 py-2 text-sm font-bold text-pine"
        >
          ← Back to the real landing page
        </Link>
      </div>
    </div>
  );
}
