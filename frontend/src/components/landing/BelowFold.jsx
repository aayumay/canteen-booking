import {
  ClosingCta,
  CounterGallery,
  DoodleShowcase,
  Faq,
  Features,
  HowItWorks,
  PhotoBand,
} from "./sectionsBelow.jsx";

/**
 * Everything below the hero, in one component so the page has a single
 * narrative order.
 *
 * This was previously loaded through React.lazy to keep it out of the initial
 * bundle, but the chunk only builds to ~10KB - deferring that saved nothing
 * while costing an extra round-trip, and swapping the short Suspense spinner
 * for ~6000px of real content moved every element below it. That measured as
 * 0.10 CLS on a throttled connection, which shows up as the page visibly
 * lurching once the chunk lands. Shipping it eagerly is both smaller in total
 * and stable.
 */
export default function BelowFold({ primaryHref, signedIn }) {
  return (
    <>
      <HowItWorks />
      <Features />
      <PhotoBand />
      <CounterGallery />
      <DoodleShowcase />
      <Faq />
      <ClosingCta primaryHref={primaryHref} signedIn={signedIn} />
    </>
  );
}
