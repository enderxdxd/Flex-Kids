---
name: ckm:ui-ux-pro-max
description: "UI/UX design intelligence: 50+ styles, 161 color palettes, 57 font pairings, 161 product types, 99 UX guidelines, 25 chart types across 10 stacks. Use when designing pages, creating UI components, choosing design systems, reviewing UI code, implementing navigation, making product design decisions."
argument-hint: "[product-type] [style-preference]"
license: MIT
metadata:
  author: nextlevelbuilder
  version: "1.0.0"
---

# UI/UX Pro Max - Design Intelligence

This comprehensive design guide provides structured frameworks for creating professional user interfaces across web and mobile platforms. It encompasses 50+ design styles, 161 color palettes, 57 font pairings, 161 product types, 99 UX guidelines, and 25 chart types across 10 technology stacks.

## Core Purpose

Apply design thinking whenever: "If the task will change how a feature looks, feels, moves, or is interacted with, this Skill should be used."

## When to Use

**Must Use:**
- Designing pages or screens from scratch
- Creating UI components
- Choosing or implementing design systems
- Reviewing UI/UX code for quality
- Implementing navigation patterns
- Making product design decisions

**Recommended:**
- When UI quality is unclear or inconsistent
- After receiving usability feedback
- Pre-launch optimization
- Cross-platform alignment

**Skip:**
- Backend logic only
- API/database design with no UI impact
- Non-visual infrastructure work

## Priority-Based Rule Categories (1-10)

1. **Accessibility (CRITICAL)** — Contrast 4.5:1 minimum, keyboard navigation, ARIA labels, alt text, focus states
2. **Touch & Interaction (CRITICAL)** — 44×44px minimum touch targets, 8px spacing, loading feedback within 150ms
3. **Performance (HIGH)** — Image optimization, lazy loading, CLS < 0.1, layout shift prevention
4. **Style Selection (HIGH)** — Match product type consistently, use SVG icons (no emoji), coherent visual language
5. **Layout & Responsive (HIGH)** — Mobile-first, viewport meta tag, no horizontal scroll
6. **Typography & Color (MEDIUM)** — 16px base font, 1.5–1.75 line-height, semantic color tokens
7. **Animation (MEDIUM)** — 150–300ms duration, meaningful motion only, respect prefers-reduced-motion
8. **Forms & Feedback (MEDIUM)** — Visible labels, inline error placement, progressive disclosure
9. **Navigation Patterns (HIGH)** — Bottom nav ≤5 items, predictable back behavior, deep linking support
10. **Charts & Data (LOW)** — Accessible color usage in charts, visible legends, table alternatives

## Implementation Workflow

**Step 1:** Analyze product type, target audience, platform, and style preferences

**Step 2:** Generate complete design system — select from 161 palettes and 57 font pairings matching the product category

**Step 3:** Apply domain-specific UX guidelines from the 99 rules database

**Step 4:** Implement with stack-specific guidelines (React, Next.js, Vue, Svelte, React Native, SwiftUI, Flutter)

## Common Professional Standards

**Avoid:**
- Emoji icons (use SVG icon sets instead)
- Inconsistent stroke widths across icons
- Low-contrast text in either light or dark mode
- Unsafe-area collisions on mobile
- Random spacing values (use 4/8dp rhythm)
- Unlabeled interactive controls
- Hardcoded colors (use semantic tokens)
- Disabled states that look tappable

**Ensure:**
- Vector icons with consistent visual weight
- Tap/click feedback within 150ms
- Touch targets ≥ 44pt on all platforms
- Safe-area inset compliance (iOS notch, home indicator)
- 4/8dp spacing rhythm throughout
- Semantic color tokens for theming
- Proper accessibility labels and focus management
- Theme contrast validation (light AND dark modes)

## UI Styles Reference (50+)

| Category | Styles |
|----------|--------|
| Modern | Glassmorphism, Neumorphism, Claymorphism |
| Classic | Minimalism, Flat Design, Material Design |
| Bold | Brutalism, Bold Typography, Memphis |
| Structured | Bento Grid, Dashboard, Card-based |
| Artistic | Retro, Skeuomorphism, Organic/Blob |

## Platform-Specific Guidelines

### Web
- Viewport: `<meta name="viewport" content="width=device-width, initial-scale=1">`
- Breakpoints: 320px, 768px, 1024px, 1440px
- Max content width: 1200–1440px with padding

### React Native / Mobile
- Follow iOS HIG and Android Material Design 3
- Status bar handling and safe areas required
- Native navigation patterns per platform

### iOS (SwiftUI)
- SF Symbols for icons
- Dynamic Type support required
- Human Interface Guidelines compliance

### Android
- Material Design 3 components
- 8dp baseline grid
- Predictive back gesture support

## Pre-Delivery Checklist

- [ ] Accessibility labels on all interactive elements
- [ ] Touch targets ≥ 44×44px verified
- [ ] Interaction feedback timing ≤ 150ms
- [ ] Theme contrast validated (light + dark)
- [ ] Reduced-motion alternative implemented
- [ ] No horizontal scroll on mobile
- [ ] Icon stroke widths consistent throughout
- [ ] Error states designed and implemented
