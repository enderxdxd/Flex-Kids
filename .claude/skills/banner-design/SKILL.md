---
name: ckm:banner-design
description: "Design banners, covers, and headers for social media, advertising, web, and print. Generates multiple art direction options per request. Platforms: Facebook, Twitter/X, LinkedIn, YouTube, Instagram, Google Ads, website heroes. 22 art direction styles. Use when creating social covers, ad banners, hero images, or any banner-format visual."
argument-hint: "[platform] [purpose] [style]"
license: MIT
metadata:
  author: claudekit
  version: "1.0.0"
---

# Banner Design

Multi-platform banner creation: social media, advertising, web, print. Generates multiple art direction options with AI-powered visual elements.

## When to Use

- Social media covers and profile banners
- Digital advertising (Google Ads, Meta, LinkedIn)
- Website hero sections and headers
- Email header graphics
- Print banner materials

**Out of scope:** Video editing, full website design, print production files.

## Core Workflow

### Step 1: Gather Requirements
Ask via `AskUserQuestion`:
- **Purpose:** What is this banner for?
- **Platform/Dimensions:** Which platform(s)?
- **Content:** Headline, subtext, CTA, images/logos to include
- **Brand:** Colors, fonts, style guidelines
- **Style preference:** Minimalist, bold, gradient, photo-based, etc.
- **Quantity:** How many options desired?

### Step 2: Research Art Direction
- Activate `ckm:ui-ux-pro-max` for style intelligence
- Browse Pinterest references for inspiration
- Select 2-3 complementary styles to execute

### Step 3: Design & Generate
- Create HTML/CSS banners at exact platform dimensions
- Generate visual elements:
  - **Standard (Flash):** backgrounds, gradients, patterns at 2K resolution
  - **Pro model:** detailed illustrations and hero visuals at 4K resolution

### Step 4: Export to Images
- Screenshot HTML at exact dimensions
- Auto-compress if needed
- Verify visual quality

### Step 5: Present & Iterate
- Show all options side-by-side with rationale
- Collect feedback
- Refine selected option

## Platform Sizes Reference

### Social Media
| Platform | Type | Size (px) | Notes |
|----------|------|-----------|-------|
| Facebook | Cover Photo | 820 × 312 | Displays at 820×312 desktop, 640×360 mobile |
| Facebook | Event Cover | 1920 × 1005 | |
| Twitter/X | Header | 1500 × 500 | |
| LinkedIn | Personal Banner | 1584 × 396 | |
| LinkedIn | Company Banner | 1128 × 191 | |
| YouTube | Channel Art | 2560 × 1440 | Safe area: 1546×423 |
| Instagram | Post | 1080 × 1080 | |
| Instagram | Story | 1080 × 1920 | |
| Instagram | Landscape | 1080 × 566 | |
| Pinterest | Pin | 1000 × 1500 | |
| TikTok | Profile | 200 × 200 | |

### Advertising
| Format | Size (px) | Notes |
|--------|-----------|-------|
| Leaderboard | 728 × 90 | Top of page |
| Medium Rectangle | 300 × 250 | Most common |
| Large Rectangle | 336 × 280 | |
| Half Page | 300 × 600 | |
| Billboard | 970 × 250 | |
| Wide Skyscraper | 160 × 600 | |

### Web
| Type | Size (px) |
|------|-----------|
| Hero (standard) | 1920 × 600–1080 |
| Hero (tall) | 1920 × 1080 |
| Section banner | 1920 × 400 |
| Email header | 600 × 200 |

## Art Direction Styles (22)

| Style | Best For | Mood |
|-------|----------|------|
| Minimalist | SaaS, tech, professional | Clean, focused |
| Bold Typography | Announcements, sales | Impactful |
| Gradient | Modern brands, apps | Dynamic |
| Photo-Based | Lifestyle, e-commerce | Authentic |
| Geometric | Tech, fintech, enterprise | Structured |
| Glassmorphism | SaaS, apps, premium | Modern |
| Neon/Cyberpunk | Gaming, events, youth | Energetic |
| Retro/Vintage | Food, fashion, nostalgia | Warm |
| Duotone | Editorial, music | Artistic |
| Editorial | Luxury, fashion | Sophisticated |
| Flat Illustration | Education, health | Friendly |
| 3D/Dimensional | Product launches | Premium |
| Collage | Creative, youth | Eclectic |
| Organic/Blob | Wellness, beauty | Soft |
| Dark/Moody | Premium, gaming | Dramatic |
| Pastel/Soft | Beauty, lifestyle | Gentle |
| Corporate Clean | B2B, finance | Professional |
| Memphis/Pop | Retail, food | Playful |
| Nature/Organic | Sustainability, food | Earthy |
| Abstract | Tech, innovation | Forward-thinking |
| Split Layout | Comparison, features | Clear |
| Isometric | Tech, SaaS | Technical |

## Design Rules

### Layout
- Safe zones: critical content in central **70-80%** of canvas
- One primary CTA per banner
- CTA placement: bottom-right preferred, min 44px height
- Text hierarchy: max 3 levels (headline, subheadline, CTA)

### Typography
- Maximum **2 typefaces** per banner
- Minimum **16px body text**, **≥32px headline**
- High contrast between text and background

### Advertising Compliance
- Text under **20% of image area** (Meta/Facebook penalizes more)
- Alt text required for accessibility
- Brand logo in consistent position (usually top-left or bottom-right)

### Print
- **300 DPI minimum**
- **CMYK color mode**
- **3–5mm bleed** on all sides
- Fonts embedded or outlined

### Contrast
- Text contrast ratio ≥ **4.5:1** for normal text
- ≥ **3:1** for large text (18pt+ or 14pt bold+)

## Color Guidelines

- Use brand colors as primary palette
- Limit to **3-4 colors maximum** per banner
- Ensure readability in both digital and print contexts
- Test dark and light versions when applicable

## Quick Templates by Use Case

### Product Launch
- Style: Bold Typography or 3D/Dimensional
- Layout: Product image center, headline above, CTA below
- Colors: Brand primary + high-contrast accent

### Event Promotion
- Style: Photo-Based or Neon
- Layout: Event name large, date/location prominent
- Colors: Event brand palette

### Sale/Promotion
- Style: Bold Typography or Memphis/Pop
- Layout: Discount/offer headline center, urgency element
- Colors: High contrast, warm colors (red, orange, yellow)

### Brand Awareness
- Style: Minimalist or Editorial
- Layout: Logo prominent, tagline, subtle background
- Colors: Full brand palette

### SaaS/Tech Product
- Style: Glassmorphism or Geometric
- Layout: Interface screenshot or abstract, headline, CTA
- Colors: Blues, purples, teals
