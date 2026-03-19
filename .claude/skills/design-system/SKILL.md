---
name: ckm:design-system
description: "Design token architecture, component specifications, CSS variable systems, spacing/typography scales, and slide/presentation generation for brand-compliant decks. Use when creating design tokens, establishing CSS variable systems, building component specs, or generating presentation slides."
argument-hint: "[token-type or slide-topic]"
license: MIT
metadata:
  author: claudekit
  version: "1.0.0"
---

# Design System

Manages token architecture, component specifications, and presentation generation using a three-layer token system.

## When to Use

- Creating or updating design tokens
- Establishing CSS variable systems
- Building component specifications
- Generating brand-compliant presentations/slides
- Defining spacing and typography scales
- Ensuring token compliance across the codebase

## Token Architecture

Three-layer system:

```
Primitive (raw values) → Semantic (purpose aliases) → Component (component-specific)
```

### Layer 1: Primitive Tokens
Raw values — colors as hex/hsl, sizes as px/rem:
```css
--color-blue-500: #3b82f6;
--size-4: 1rem;
--font-sans: 'Inter', sans-serif;
```

### Layer 2: Semantic Tokens
Purpose-based aliases that reference primitives:
```css
--color-primary: var(--color-blue-500);
--color-background: var(--color-gray-50);
--spacing-md: var(--size-4);
```

### Layer 3: Component Tokens
Component-specific tokens that reference semantic tokens:
```css
--button-bg: var(--color-primary);
--card-padding: var(--spacing-md);
--input-border: var(--color-border);
```

## Core Requirements

All components and slides must:
- Import `assets/design-tokens.css` as the single source of truth
- Use CSS variables exclusively — **no hardcoded hex values**
- Support both light and dark mode via token switching

### Correct Approach
```css
background: var(--slide-bg);
color: var(--color-primary);
border: 1px solid var(--color-border);
```

### Incorrect Approach
```css
background: #0D0D0D;    /* hardcoded — forbidden */
color: #6366F1;         /* hardcoded — forbidden */
```

## Slide Generation

Strategic HTML presentations using Chart.js, contextual decision trees, and design tokens.

### Requirements for Slides
- Import `design-tokens.css`
- Use CSS variables exclusively
- Include Chart.js for data visualizations
- Support keyboard/click navigation with progress tracking
- Center-align content for persuasion focus

### Slide System Inputs
Seven data sources drive contextual recommendations:
1. Slide strategies (emotional arc, pacing)
2. Layout patterns (grid, hero, split, etc.)
3. Typography pairings
4. Color palettes
5. Background imagery (Pexels/Unsplash)
6. Copywriting formulas (AIDA, PAS, etc.)
7. Chart.js configurations (25 chart types)

## Typography Scale

```css
--text-xs: 0.75rem;     /* 12px */
--text-sm: 0.875rem;    /* 14px */
--text-base: 1rem;      /* 16px - minimum body */
--text-lg: 1.125rem;    /* 18px */
--text-xl: 1.25rem;     /* 20px */
--text-2xl: 1.5rem;     /* 24px */
--text-3xl: 1.875rem;   /* 30px */
--text-4xl: 2.25rem;    /* 36px */
--text-5xl: 3rem;       /* 48px */
```

## Spacing Scale (4/8dp Rhythm)

```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

## Component Specification Format

```markdown
## ComponentName

**Purpose:** What this component does
**States:** default, hover, focus, disabled, loading, error
**Variants:** primary, secondary, ghost, destructive

### Anatomy
- Container: var(--component-bg), var(--component-border-radius)
- Label: var(--text-sm), var(--font-weight-medium)
- Icon: 16×16px, var(--color-icon)

### Sizing
- sm: height 32px, padding 8px 12px
- md: height 40px, padding 10px 16px
- lg: height 48px, padding 12px 20px

### Accessibility
- role, aria attributes required
- Focus ring: 2px var(--color-focus-ring)
- Min touch target: 44×44px
```

## Token Compliance Validation

Before delivery, verify:
- [ ] No hardcoded color values in components
- [ ] All spacing uses token variables
- [ ] Typography uses scale tokens
- [ ] Dark mode tokens defined for all semantic tokens
- [ ] Component tokens reference semantic (not primitive) layer
