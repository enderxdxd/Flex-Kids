---
name: ckm:slides
description: "Create strategic HTML presentations with Chart.js, design tokens, responsive layouts, and copywriting formulas. Use when building pitch decks, marketing presentations, data-driven slides, or any presentation content."
argument-hint: "[topic] [slide-count]"
license: MIT
metadata:
  author: claudekit
  version: "1.0.0"
---

# Slides

Strategic HTML presentation creation with Chart.js, design tokens, persuasive copywriting, and contextual slide strategies.

## When to Use

- Marketing presentations and pitch decks
- Data visualizations and dashboards
- Strategic business presentations
- Product demos and feature overviews
- Investor decks
- Training and educational content

## Core Capabilities

- **Layout patterns:** Hero, split, grid, timeline, comparison, data-heavy
- **Data visualization:** 25 Chart.js chart types
- **Copywriting:** AIDA, PAS, storytelling formulas
- **Design tokens:** Brand-consistent styling via CSS variables
- **Navigation:** Keyboard and click controls with progress tracking

## Creation Workflow

### Step 1: Strategy
Determine presentation goal and emotional arc:
- **Persuade:** Problem → Solution → Proof → CTA
- **Inform:** Context → Details → Takeaways
- **Inspire:** Vision → Challenge → Opportunity → Call to action
- **Report:** Summary → Data → Analysis → Recommendations

### Step 2: Structure
Plan slide sequence (recommended counts):
- Pitch deck: 10-15 slides
- Product demo: 8-12 slides
- Report: 6-10 slides
- Training: 15-25 slides

### Step 3: Content
Apply copywriting formulas per slide type:
- **Hero/Title:** Benefit-led headline, not feature-led
- **Problem:** Agitate the pain with specifics
- **Solution:** One clear value proposition
- **Proof:** Data, testimonials, case studies
- **CTA:** Single clear next action

### Step 4: Design
- Import `design-tokens.css`
- Use CSS variables for all colors/spacing
- Apply layout pattern from library
- Add Chart.js for data slides

### Step 5: Export
- HTML file opens in any browser
- Print to PDF for sharing
- Screenshot for static images

## Technical Requirements

### HTML Template Structure
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="assets/design-tokens.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <title>Presentation Title</title>
</head>
<body>
  <div class="presentation">
    <div class="slide active" id="slide-1">
      <!-- Slide content -->
    </div>
    <!-- More slides -->
  </div>
  <nav class="slide-nav">
    <button id="prev">←</button>
    <span id="progress">1 / 10</span>
    <button id="next">→</button>
  </nav>
</body>
</html>
```

### Token Compliance (Mandatory)
```css
/* CORRECT — use CSS variables */
background: var(--slide-bg);
color: var(--color-primary);
padding: var(--space-8);

/* WRONG — no hardcoded values */
background: #0D0D0D;
color: #6366F1;
```

### Navigation Script
```javascript
let current = 0;
const slides = document.querySelectorAll('.slide');

function goTo(n) {
  slides[current].classList.remove('active');
  current = Math.max(0, Math.min(n, slides.length - 1));
  slides[current].classList.add('active');
  document.getElementById('progress').textContent = `${current + 1} / ${slides.length}`;
}

document.getElementById('next').onclick = () => goTo(current + 1);
document.getElementById('prev').onclick = () => goTo(current - 1);
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') goTo(current + 1);
  if (e.key === 'ArrowLeft') goTo(current - 1);
});
```

## Layout Patterns

### Hero Slide
```html
<div class="slide hero-layout">
  <h1 class="headline">Main Value Proposition</h1>
  <p class="subheadline">Supporting context in one sentence</p>
  <button class="cta">Get Started</button>
</div>
```

### Split Layout (Text + Visual)
```html
<div class="slide split-layout">
  <div class="content-left">
    <h2>Key Point</h2>
    <p>Supporting detail</p>
    <ul>
      <li>Benefit one</li>
      <li>Benefit two</li>
    </ul>
  </div>
  <div class="content-right">
    <canvas id="chart1"></canvas>
  </div>
</div>
```

### Data/Stats Slide
```html
<div class="slide stats-layout">
  <h2>Key Metrics</h2>
  <div class="stats-grid">
    <div class="stat">
      <span class="stat-number">98%</span>
      <span class="stat-label">Customer Satisfaction</span>
    </div>
    <!-- More stats -->
  </div>
</div>
```

## Chart.js Quick Reference

### Bar Chart
```javascript
new Chart(ctx, {
  type: 'bar',
  data: {
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    datasets: [{
      label: 'Revenue',
      data: [120, 190, 300, 500],
      backgroundColor: 'var(--color-primary)'
    }]
  }
});
```

### Line Chart (Trend)
```javascript
new Chart(ctx, {
  type: 'line',
  data: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
    datasets: [{
      label: 'Growth',
      data: [10, 25, 40, 65, 100],
      borderColor: 'var(--color-primary)',
      tension: 0.4
    }]
  }
});
```

### Doughnut Chart
```javascript
new Chart(ctx, {
  type: 'doughnut',
  data: {
    labels: ['Segment A', 'Segment B', 'Segment C'],
    datasets: [{
      data: [45, 30, 25],
      backgroundColor: ['var(--color-primary)', 'var(--color-secondary)', 'var(--color-accent)']
    }]
  }
});
```

## Copywriting Formulas

### AIDA (Attention-Interest-Desire-Action)
1. **Attention:** Shocking stat or bold claim
2. **Interest:** Why this matters to them
3. **Desire:** Paint the picture of success
4. **Action:** Single clear CTA

### PAS (Problem-Agitate-Solution)
1. **Problem:** Identify the pain point
2. **Agitate:** Make the problem feel urgent/costly
3. **Solution:** Present your answer

### Story Arc
1. **Status Quo:** How things are now
2. **Conflict:** What's changing/broken
3. **Resolution:** Your solution
4. **New World:** Life after your solution

## Best Practices

- **One idea per slide** — never cram multiple points
- **Headline = takeaway** — write it so someone gets the point without reading the slide
- **Data needs context** — always explain what the number means
- **Consistent alignment** — center-align for persuasion, left-align for information
- **Whitespace is content** — don't fill every pixel
- **Visible progress** — always show slide position (e.g., "3 of 12")
