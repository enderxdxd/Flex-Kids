---
name: ckm:brand
description: "Brand identity, voice, messaging, asset management, and consistency frameworks. Use when working with branded content, tone of voice, marketing assets, brand compliance, style guides, or when establishing/updating brand guidelines."
argument-hint: "[brand-action] [context]"
license: MIT
metadata:
  author: claudekit
  version: "1.0.0"
---

# Brand

Manages brand identity across voice, visuals, messaging, and assets.

## When to Use

- Defining or updating brand voice and tone
- Creating or reviewing brand guidelines
- Managing visual identity (colors, typography, logo usage)
- Auditing brand compliance across materials
- Organizing and validating brand assets
- Syncing brand guidelines to design tokens

## Core Workflows

### 1. Update Brand Guidelines
Edit `docs/brand-guidelines.md` → sync to tokens → validate outputs.

Three synchronized files:
- `docs/brand-guidelines.md` (source of truth)
- `assets/design-tokens.json` (token output)
- `assets/design-tokens.css` (CSS output)

### 2. Sync Brand to Design Tokens
After editing brand guidelines, sync changes to design tokens:
```bash
node scripts/sync-brand-to-tokens.cjs
```

### 3. Validate Assets
Check asset naming, dimensions, and file formats:
```bash
node scripts/validate-asset.cjs assets/logo.svg
```

### 4. Extract Colors
Analyze colors in images against your defined palette:
```bash
node scripts/extract-colors.cjs assets/hero-image.png
```

### 5. Inject Brand Context
Extract brand information for use in prompts:
```bash
node scripts/inject-brand-context.cjs
```

## Brand Guidelines Structure

### Voice & Messaging
- **Tone:** [formal/casual/playful/authoritative]
- **Personality traits:** [list 3-5 adjectives]
- **Writing style:** sentence length, punctuation style, vocabulary level
- **Words to use:** power words aligned to brand
- **Words to avoid:** terms that conflict with brand positioning

### Visual Identity
- **Primary color:** hex + usage context
- **Secondary colors:** hex + usage rules
- **Accent colors:** hex + sparingly-used contexts
- **Typography:** heading font + body font + monospace font
- **Logo usage:** clear space, minimum size, forbidden treatments

### Messaging Framework
- **Tagline:** one-sentence brand promise
- **Elevator pitch:** 2-3 sentence overview
- **Value propositions:** 3-5 key benefits
- **Target audience:** primary persona description

### Asset Standards
- **File naming:** `brand-[asset-type]-[variant]-[size].[ext]`
- **Required formats:** SVG (vector), PNG (raster), WebP (web)
- **Minimum logo size:** 32px height for digital
- **Safe zones:** 1× logo height on all sides

## Brand Audit Checklist

- [ ] Logo used correctly (not stretched, proper clear space)
- [ ] Brand colors match guidelines (no off-palette colors)
- [ ] Typography follows brand fonts only
- [ ] Tone of voice consistent with brand personality
- [ ] Asset filenames follow naming convention
- [ ] All images properly compressed and formatted

## Integration with Other Skills

| Next Step | Skill |
|-----------|-------|
| Create design tokens from brand | `ckm:design-system` |
| Style UI components | `ckm:ui-styling` |
| Generate logos | `ckm:design` (logo built-in) |
| Design banners with brand | `ckm:banner-design` |
| Create branded presentations | `ckm:slides` |
