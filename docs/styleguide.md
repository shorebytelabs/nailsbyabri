## Nails by Abri — Mobile UI Styleguide

### Color Tokens

| Token | Light Mode | Dark Mode | Usage | Contrast Notes |
| --- | --- | --- | --- | --- |
| `color-primary` | `#6F171F` | `#F4EBE3` | Primary CTAs (FAB, progress accents) | On light surfaces, text/icons should be white (`#FFFFFF`) for 7.2:1 contrast. |
| `color-secondary` | `#BF9B7A` | `#3A2C24` | Highlights, status chips, subtle gradients | Ensure body text placed over secondary meets 4.5:1. |
| `color-background` | `#F4EBE3` | `#1C1816` | App shell background | Maintain ≥4.5:1 with `color-primaryFont`. |
| `color-surface` | `#FFFFFF` | `#281F1B` | Cards, panels | Borders use `color-border`. |
| `color-accent` | `#531C22` | `#F4DDD3` | Emphasised text, chips, icons | Accessible with white text (8.5:1). |
| `color-primaryFont` | `#220707` | `#F9F3ED` | Headlines, body copy | Meets AA on background and surface. |
| `color-secondaryFont` | `#5C5F5D` | `#D9C8A9` | Hints, helper text | Use for non-essential copy; ensure legibility on surface. |
| `color-border` | `#D9C8A9` | `#4A3B34` | Card outlines, dividers | Maintain 1px hairline. |
| `color-success` | `#3E7C59` | `#CBE8D9` | Positive states | Pair with white or `color-background`. |
| `color-error` | `#B33A3A` | `#FBD7D7` | Errors, blocking alerts | White text recommended. |

### Spacing & Layout

- Core spacing scale: 4, 8, 12, 16, 20, 24, 32.
- Card radius: 18 px for primary surfaces; buttons use 16–24 px.
- Minimum touch target: 44 × 44 px (FAB 68 × 68 px).
- Bottom tab height: 72 px, icons centred with 6 px gap to label.
- Stepper layout uses 20 px horizontal padding, progress bar height 6 px.

### Typography

- Heading (hero): 24 px, weight 800.
- Section title: 18 px, weight 700.
- Body: 14 px, weight 500.
- Helper/caption: 12 px, weight 600.
- Use letter-spacing 0.2–0.3 for uppercase labels.

### Components

#### FAB (`FloatingCreateButton`)
- Shape: Circular 68 px.
- Background: `color-accent`; disabled uses 20% opacity.
- Shadow: elevation 12, 8 px vertical offset, radius 16.
- Animation: initial bounce (translateY −10 px).
- Long-press reveals pill label with `Create Set`.

#### Tab Bar (`BottomTabBar`)
- Height 72 px, background `color-background`.
- Icons (24–26 px) colour transitions between `color-accent` (active) and `color-secondaryFont`.
- Labels uppercase, 11 px, weight 600.

#### Stepper (`NewOrderStepperScreen`)
- Steps: Shape → Design → Sizing → Fulfilment → Review.
- Progress indicator: filled bar with `color-accent`.
- Back/Next buttons: `PrimaryButton` for progression, outlined button for Save Draft.
- Mini-preview card shows shape name, description, palette chips.

#### Order Card (`OrdersScreen`, Home strip)
- Container: 200 px width, radius 18 px, border `color-border`.
- Status chips: pill with background `color-accent` at 10–20% opacity.
- Metadata size 12 px.

### Accessibility

- All CTAs include explicit `accessibilityLabel`.
- FAB and Create tab emit stub analytics events (`tap_fab_create`, `tap_nav_create`).
- Ensure text over secondary backgrounds meets WCAG AA (use `color-primaryFont` or white as needed).
- Provide motion-reduced path (bounce animation duration < 400 ms).

### Copy Variants (for A/B testing)

- Variant A: “Create Set”
- Variant B: “Design”
- Variant C: “Make Magic”

Use the variant strings for CTA buttons or experiment within the review step microcopy.

