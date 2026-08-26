/**
 * The ambient backdrop for centered, card-forward screens (sign-in, sign-up,
 * onboarding, password reset, auth callback). Soft palette-tinted glows plus
 * the brand's concentric circle motif (echoing the ◔ mark and the focus /
 * day-progress rings). Purely decorative — always aria-hidden and behind the
 * content. Colors come only from the ambient tokens in globals.css.
 */
export function AmbientBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute -top-24 -left-24 size-[46rem] bg-(image:--glow-iris)" />
      <div className="absolute -bottom-32 -right-24 size-[42rem] bg-(image:--glow-lilac)" />
      <div className="absolute top-1/2 -right-32 size-[30rem] -translate-y-1/2 bg-(image:--glow-peach) opacity-70" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="absolute -translate-x-1/2 -translate-y-1/2 size-[30rem] rounded-full border border-iris/30 dark:border-iris/15" />
        <div className="absolute -translate-x-1/2 -translate-y-1/2 size-[42rem] rounded-full border border-iris/20 dark:border-iris/10" />
        <div className="absolute -translate-x-1/2 -translate-y-1/2 size-[54rem] rounded-full border border-iris/[0.12] dark:border-iris/[0.06]" />
      </div>
    </div>
  );
}
