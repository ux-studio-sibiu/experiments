---
name: design-principles
description: >-
  General UI/UX and interaction-design principles to apply when building,
  reproducing, or tweaking any effect, demo, or component in this collection.
  Use whenever making design/interaction decisions — animation timing, hover
  and click feedback, responsiveness, motion, accessibility, layout — or when
  the user asks for something to feel "fast", "snappy", "responsive", "smooth",
  or "polished". Complements the extract-effect skill (which covers packaging).
---

# Design principles for effects & demos

These are the defaults to reach for in this repo. They keep effects feeling
**fast, responsive, and intentional**. When a request conflicts with one, the
explicit request wins — but otherwise, follow these.

## Interaction speed (most important)

**Direct feedback to a user action should be instant or near-instant.** When
someone hovers, clicks, focuses, or taps, the visual acknowledgement must feel
immediate — never make the user wait to find out their input registered.

- **Hover / focus / active / press feedback: 0ms (instant) or ≤ 100ms.**
  - The newformcap-style menu items use an **instant** hover (no `transition`
    on the hovered property) — that's the bar. Put only *entrance/reveal*
    properties in a `transition`, and leave hover-state properties out so they
    flip instantly. (See `static-background/index.html`'s `.nav a`.)
  - If you do ease a hover, keep it ≤ 100–120ms; anything slower reads as laggy.
- **State/entrance transitions** (a menu opening, a panel sliding in): 150–300ms.
- **Large layout / page transitions**: up to ~400–500ms, but never block input.
- **Easing**: `ease-out` / custom cubic-beziers that start fast for things that
  appear; avoid `ease-in` on incoming elements (feels sluggish to start).
- **Never gate interactivity on an animation.** Clicks must work mid-transition.
- **Input handling**: throttle expensive work to `requestAnimationFrame`,
  `passive` listeners for scroll/touch, debounce only *trailing* work (search),
  never debounce direct feedback.

> Rule of thumb: if the user caused it directly, it should look instant. If the
> system is presenting something, a short graceful transition is fine.

## Responsiveness (works at any size / input)

- **Fluid sizing**: prefer `clamp()`, `%`, `vw/vh`, flex/grid over fixed px for
  anything user-facing. Effects should fill and adapt to their container.
- **React to container, not just window** (`ResizeObserver`) so an effect works
  when embedded, not only full-screen.
- **Honour device pixel ratio** but cap it (≈2) for canvas/WebGL perf.
- **Touch + mouse + keyboard**: hover effects need a non-hover fallback; ensure
  focus states exist and are visible; hit targets ≥ 44px on touch.
- Verify at mobile / tablet / desktop widths (`preview_resize`).

## Motion & restraint

- Motion should support comprehension (where did this come from / go to), not
  decorate. Subtle beats flashy; one clear motion beats several competing ones.
- **Respect `prefers-reduced-motion`**: drop or shorten non-essential animation,
  render a still/instant state instead. Every effect should degrade gracefully.
- Keep idle CPU/GPU low: pause loops when hidden/offscreen; don't animate what
  isn't visible.

## Visual clarity

- Consistent spacing scale, alignment, and a small type scale (`clamp()` headings).
- Sufficient contrast (aim WCAG AA); don't rely on colour alone for state.
- Establish clear stacking/elevation; keep z-index intentional and documented.
- Default to the calmer / more privacy- and motion-respecting option.

## Performance budget

- 60fps target; if a frame can't hold it, lower resolution/quality before
  dropping frames.
- Avoid layout thrash (batch reads then writes); prefer `transform`/`opacity`
  (compositor-friendly) over animating layout properties.
- Clean up: cancel RAF/timers, remove listeners/observers, dispose GPU
  resources on teardown.

## Quick checklist (apply before calling a demo/effect done)

- [ ] Hover/press feedback is instant (or ≤100ms) — no slow transition on
      directly-triggered states.
- [ ] Nothing blocks clicks/scroll during a transition.
- [ ] Scales fluidly; reacts to container resize; works on touch + keyboard.
- [ ] `prefers-reduced-motion` path exists.
- [ ] Animations use `transform`/`opacity`; loops pause when hidden.
- [ ] Teardown leaves no leaked listeners/RAF.
