# Sprint 19 — Accessibility audit (engineering)

Companion to Sprint 18F design/a11y work and `docs` design tokens.

## Controls already in place

- Skip link → `#main-content`  
- Focus-visible rings on interactive controls  
- Bottom sheets / mobile nav: Escape, focus trap, restore focus  
- Search: aria-live result counts  
- Status badges: sr-only “Status:”  
- Reduced motion: decorative + enter animations disabled  
- Archive table: `<caption>`, `scope="col"`, keyboardable filters  
- Locale error boundary: `role="alert"` + try-again  

## Sprint 19 improvements

- Root + locale `not-found`: `role="status"` + `aria-live="polite"`  
- Locale-aware home/archive/search links on 404/500 recovery  
- Smoke covers archive + methodology availability for progressive enhancement paths  

## Manual staging pass (ops)

At 320 / 375 / 768 / 1024 / 1440 widths:

1. Keyboard-only nav through header, search, archive filters, Acca sheet  
2. Focus order does not trap outside sheets  
3. Contrast on brand CTAs vs canvas  
4. Screen reader announces 404 and error recovery  
5. Landscape mobile: filter toolbar remains scrollable (no wrap soup)

## Explicit deferrals

- Full axe CI gate (optional later)  
- Full non-EN research chrome translation (content, not a11y infra)  
