# Availo Design System

Extracted from `CLAUDE_DESIGN/Availo Design System.html` and referenced files in `CLAUDE_DESIGN/`: `tokens.js`, `components/brand.jsx`, `components/components.jsx`, `components/screens.jsx`, `design-canvas.jsx`, and `tweaks-panel.jsx`.

## Color Tokens

### Base Neutrals

Use warm-tinted slate neutrals throughout the app.

| Token | Hex | Usage |
| --- | --- | --- |
| `neutral0` | `#ffffff` | Primary surface, cards, sidebar, inputs |
| `neutral50` | `#f8f8f7` | App/page background, subtle panels |
| `neutral100` | `#f1f0ee` | Secondary background, disabled fills, dividers |
| `neutral200` | `#e4e2de` | Default borders |
| `neutral300` | `#cac7c1` | Muted controls, empty placeholders |
| `neutral400` | `#a8a49c` | Subtle text, placeholders, inactive mobile nav |
| `neutral500` | `#7d7970` | Muted text |
| `neutral600` | `#5c5852` | Secondary text, default nav text |
| `neutral700` | `#3e3b37` | Strong secondary text |
| `neutral800` | `#2a2825` | Dark chrome |
| `neutral900` | `#1a1916` | Primary text, dark headers |

### Accent Teal

`accent500` is the primary CTA color.

| Token | Hex | Usage |
| --- | --- | --- |
| `accent50` | `#eef7f6` | Active nav background, selected card background |
| `accent100` | `#cceae7` | Avatars, booked calendar cells, selected icon fills |
| `accent200` | `#99d5d0` | Light accent fill |
| `accent300` | `#5cbab4` | Code text and accent detail |
| `accent400` | `#2ea69f` | Focus border, ghost border |
| `accent500` | `#1e8f88` | Primary buttons, selected dates, active nav text |
| `accent600` | `#177870` | Strong accent text |
| `accent700` | `#115f59` | Dark accent |
| `accent800` | `#0b4541` | Dark accent |
| `accent900` | `#072e2b` | Darkest accent |

### Semantic Colors

| Role | Primary | Background | Border | Strong text |
| --- | --- | --- | --- | --- |
| Success | `#1a9e6e` | `#edf7f2` | `#b8e8d4` | `#0d5237` |
| Warning | `#e08c2a` | `#fef6ec` | `#fad9a8` | `#7a4a0e` |
| Error | `#d94f4f` | `#fef0f0` | `#f9c4c4` | `#7a1515` |
| Info | `#3b7fd4` | `#eff5fd` | `#b8d1f5` | `#1a3d72` |

### Dark Theme Scale

| Token | Hex |
| --- | --- |
| `dark0` | `#111210` |
| `dark50` | `#181917` |
| `dark100` | `#1f2120` |
| `dark200` | `#2b2d2b` |
| `dark300` | `#3a3d3a` |
| `dark400` | `#505450` |
| `dark500` | `#6e736e` |
| `dark600` | `#959a95` |
| `dark700` | `#bbbfbb` |
| `dark800` | `#dddedd` |
| `dark900` | `#f4f5f4` |

### CSS Custom Property Aliases

```css
:root {
  --color-accent: #1e8f88;
  --color-bg: #f8f8f7;
  --color-surface: #ffffff;
  --color-border: #e4e2de;
  --color-text: #1a1916;
  --color-muted: #7d7970;
  --color-subtle: #a8a49c;
}
```

## Typography

### Font Families

| Token | Font stack |
| --- | --- |
| `fontDisplay` | `'DM Serif Display', Georgia, serif` |
| `fontBody` | `'DM Sans', 'Helvetica Neue', Helvetica, sans-serif` |
| `fontMono` | `'JetBrains Mono', 'Fira Code', monospace` |

Load via Google Fonts: `DM Sans` weights `400`, `500`, `600`, `700`; `DM Serif Display` regular and italic; `JetBrains Mono` weights `400`, `600`.

### Type Scale

| Role | Family | Size | Weight | Line height | Letter spacing | Notes |
| --- | --- | ---: | ---: | ---: | --- | --- |
| Display | DM Serif Display | `48px` | `400` | `1.15` | `-1px` in logo, otherwise normal | Large brand/editorial moments |
| H1 | DM Sans | `36px` | `600` | `1.2` | normal | Main page titles in the type specimen |
| H2 | DM Sans | `24px` | `600` | `1.3` | normal | Section headings |
| H3 | DM Sans | `18px` | `600` | `1.4` | normal | Card/section headings |
| Body | DM Sans | `15px` | `400` | `1.6` | normal | Standard body text |
| Small | DM Sans | `13px` | `400` | `1.5` | normal | Metadata, compact rows, buttons |
| Label | DM Sans | `11px` | `600` | `1.4` | `0.08em` | Uppercase labels |
| Mono | JetBrains Mono | `13px` | `400` | `1.5` | normal | Code, tokens, embed snippets |

### Common App Text Sizes

Use `22px/700` with `-0.4px` letter spacing for dashboard/list page titles. Use `20px/700` for create/detail titles. Use `14px/600` for panel headers. Use `13px` for row content and primary compact controls. Use `11px-12px` for metadata, labels, badges, hints, and empty-state support text.

## Spacing Scale

The system uses a 4px base grid.

| Token | Pixels |
| --- | ---: |
| `space-1` | `4px` |
| `space-2` | `8px` |
| `space-3` | `12px` |
| `space-4` | `16px` |
| `space-5` | `20px` |
| `space-6` | `24px` |
| `space-7` | `28px` |
| `space-8` | `32px` |
| `space-10` | `40px` |
| `space-12` | `48px` |
| `space-16` | `64px` |
| `space-20` | `80px` |

Common layout spacing: desktop app content uses `28px 32px` padding. Dashboard grids use `14px`, `16px`, or `20px` gaps. Cards commonly use `20px 22px`, `18px 24px`, or `22px 24px` padding. Mobile screens use `16px` page padding and `10px-14px` row padding.

## Radii

| Token | Pixels | Usage |
| --- | ---: | --- |
| `radius-sm` | `6px` | Small marks, tiny controls |
| `radius-md` | `10px` | Inputs, onboarding card internals, embed code blocks |
| `radius-lg` | `14px` | Main cards, booking summary, panels |
| `radius-xl` | `20px` | Large onboarding cards, full booking widget |
| `radius-pill` | `999px` | Badges, avatars, circular steppers |

Additional observed radii: nav items use `8px`; buttons use `8px-10px`; listing cards use `12px`; selected date/time chips use `7px`; mobile device frame uses `40px` outer and `32px` inner.

## Shadows

| Token | Value | Usage |
| --- | --- | --- |
| `shadow-xs` | `0 1px 2px rgba(0,0,0,0.05)` | Small elevation |
| `shadow-sm` | `0 2px 6px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)` | Cards and compact panels |
| `shadow-md` | `0 4px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)` | Raised panels |
| `shadow-lg` | `0 8px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.05)` | Large panels |
| `shadow-xl` | `0 16px 48px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)` | Large frames |

Specific component shadows: stat cards use `0 2px 6px rgba(0,0,0,0.04)`. Listing cards default to `0 2px 8px rgba(0,0,0,0.05)` and hover to `0 6px 20px rgba(0,0,0,0.09)` with `translateY(-2px)`. Checkout and confirmation cards use `0 4px 16px rgba(0,0,0,0.07)`. Full booking widget uses `0 8px 40px rgba(0,0,0,0.12)`, compact widget uses `0 4px 20px rgba(0,0,0,0.1)`.

## Button Styles

All buttons use `DM Sans`, `cursor: pointer`, and `font-weight: 600` for primary actions unless noted.

| Variant | Background | Text | Border | Radius | Padding | Font |
| --- | --- | --- | --- | ---: | --- | --- |
| Primary | `#1e8f88` | `#ffffff` | none | `9px-10px` | `9px 18px` desktop, `13px` full width | `13px-14px / 600` |
| Secondary | `#ffffff` or transparent | `#1a1916` / `#5c5852` | `1.5px solid #e4e2de` | `8px-10px` | `8px 16px` or `9px 18px` | `12px-13px / 400-600` |
| Ghost | transparent | `#1e8f88` | `1.5px solid #2ea69f` | `9px` | `9px 18px` | `13px / 600` |
| Danger | `#fef0f0` or transparent | `#d94f4f` | `1.5px solid #f9c4c4` | `8px-9px` | `9px 18px` | `12px-13px / 500-600` |
| Disabled | `#f1f0ee` | `#a8a49c` | none | `9px` | `9px 18px` | `13px / 600` |

Behavior: primary buttons can switch to success green `#1a9e6e` after save/copy. Segmented controls sit on `#f1f0ee`, have `4px` container padding, `10px` container radius, active tab background `#ffffff`, radius `7px`, text `#1a1916`, weight `600`, and active shadow `0 1px 4px rgba(0,0,0,0.08)`.

## Badge and Status Styles

Badges are pill-shaped with `border-radius: 999px`, `font-size: 10px-11px`, `font-weight: 600`, and padding `2px 7px`, `3px 8px`, or `3px 10px` depending on density.

| Status | Background | Text |
| --- | --- | --- |
| Confirmed | `#edf7f2` | `#1a9e6e` |
| Pending | `#fef6ec` | `#e08c2a` |
| Cancelled | `#fef0f0` | `#d94f4f` |
| Draft | `#f1f0ee` | `#7d7970` |
| Active | `#eef7f6` | `#177870` |
| Paused | `#fef6ec` | `#e08c2a` |
| Full | `#1e8f88` | `#ffffff` |

Delta badges use success/error color logic: positive background `#edf7f2`, text `#1a9e6e`; negative background `#fef0f0`, text `#d94f4f`; padding `2px 7px`; include up/down arrow.

## Sidebar and Navigation Rules

Desktop sidebar is a fixed-width left rail:

| State | Width | Background | Border | Padding |
| --- | ---: | --- | --- | --- |
| Expanded | `220px` | `#ffffff` | right `1px solid #e4e2de` | `16px 10px` |
| Collapsed | `56px` | `#ffffff` | right `1px solid #e4e2de` | `16px 10px` |

Sidebar behavior: width transitions over `0.2s ease`. Items are flex rows with `gap: 10px`, icon size `16px`, text size `14px`, radius `8px`, transition `all 0.15s`, and `user-select: none`. Expanded item padding is `9px 12px`; collapsed item padding is `10px` and content is centered.

Active nav item: background `#eef7f6`, text/icon `#1e8f88`, weight `600`. Inactive item: transparent background, text/icon `#5c5852`, weight `400`.

Logo: mark is `30px` square, background `#1e8f88`, radius `8px`, white `A` at `15px/700`. Expanded wordmark uses `DM Serif Display`, `20px`, `#1a1916`, letter spacing `-0.3px`. Bottom group has top border `1px solid #f1f0ee`, padding-top `12px`, and `2px` gap.

User summary: only visible expanded; background `#f8f8f7`, radius `8px`, padding `10px 12px`, gap `10px`; avatar `28px` circle with background `#cceae7`, text `#177870`, `11px/700`.

Mobile navigation: use a sticky bottom nav with background `#ffffff`, top border `1px solid #e4e2de`, padding `8px 0 4px`. Each item is flex column, centered, `gap: 2px`; icon size `18px`; label size `9px`. Active color `#1e8f88` and weight `600`; inactive color `#a8a49c` and weight `400`.

## Card and Listing Styles

### App Shell and Panels

App screens use background `#f8f8f7`, `DM Sans`, and full-height flex layouts. Main content scroll areas use `overflow: auto` and padding `28px 32px`. Large two-column app grids use `grid-template-columns: 1fr 320px` or `1fr 340px`, gap `20px`.

Panel cards: background `#ffffff`, border `1px solid #e4e2de`, radius `14px`, overflow hidden when containing rows. Headers use padding `16px 20px` or `18px 24px`, bottom border `1px solid #f1f0ee`, title `13px-15px/600`, support text `12px` in `#a8a49c`.

### Stat Cards

Stat cards use background `#ffffff`, border `1px solid #e4e2de`, radius `12px`, padding `20px 22px`, gap `8px`, shadow `0 2px 6px rgba(0,0,0,0.04)`. Label is `12px/500 #7d7970`; value is `28px/700 #1a1916`, line-height `1.1`, letter spacing `-0.5px`.

### Listing Cards

Listing cards use background `#ffffff`, border `1px solid #e4e2de`, radius `12px`, overflow hidden, shadow `0 2px 8px rgba(0,0,0,0.05)`, cursor pointer, and transition `box-shadow 0.15s, transform 0.15s`. Hover raises to `translateY(-2px)` and shadow `0 6px 20px rgba(0,0,0,0.09)`.

Image area: height `110px`, background `#f1f0ee`, relative positioning. Placeholder icon is `36px` square, background `#e4e2de`, radius `8px`; placeholder label is `9px` mono `#a8a49c`. Status badge sits top-right at `10px`.

Content area: padding `14px 16px`. Title is `13px/600 #1a1916`, single-line ellipsis, margin-bottom `3px`. Type/meta is `11px #a8a49c`, margin-bottom `12px`. Price is `15px/700 #1e8f88`; capacity is `11px #7d7970`.

### Lists and Booking Rows

List rows use flex alignment, gap `14px`, padding `13px 20px`, separator `1px solid #f8f8f7`, and hover background `#fafaf9`. Avatars are circular: `34px` in booking lists, `44px` in guest detail, background `#cceae7`, text `#177870`, weight `700`.

Empty states use background `#f8f8f7`, dashed border `1.5px dashed #e4e2de`, radius `14px`, padding `48px 32px`, centered text. Icon is `32px #cac7c1`; title `16px/600 #1a1916`; body `13px #7d7970`, max-width `260px`; CTA uses primary button with radius `8px`, padding `9px 20px`.

## Form and Input Styles

Default label: `12px/600 #5c5852`, display block, margin-bottom `6px-8px`.

Default input/select/textarea: width `100%`, padding `9px 12px` or `10px 12px`, border `1.5px solid #e4e2de`, radius `8px`, font `13px DM Sans`, text `#1a1916`, background `#ffffff`, outline none. Focus border changes to `#2ea69f`. Textareas allow vertical resize and use the same border/radius/font.

Phone input group: wrapper display flex, border `1.5px solid #e4e2de`, radius `10px`, overflow hidden, background `#ffffff`. Country prefix uses padding `12px 14px`, background `#f8f8f7`, right border `1.5px solid #e4e2de`, font `14px`, color `#5c5852`. Inner input uses padding `12px 14px`, no border.

OTP inputs: width `44px`, height `52px`, text-align center, `20px/700`, border `1.5px solid #e4e2de`, radius `10px`, focus border `#1e8f88`.

Search field: padding `9px 14px 9px 34px`, border `1.5px solid #e4e2de`, radius `9px`, font `13px`, width `200px`, icon absolutely positioned at `left: 11px`, `top: 10px`, color `#a8a49c`.

Number steppers: circular buttons, default large variant `32px` with `18px` symbol and `1.5px` border; compact widget variant `28px` with `16px` symbol. Minus border/text `#cac7c1`/`#5c5852`; plus border/text `#1e8f88`; count text `14px-15px/600-700 #1a1916`, min-width `14px-16px`.

## Booking Widget Rules

The public booking widget is a self-contained card with no external UI dependencies.

### Container

Full widget: max-width `400px`, background `#ffffff`, radius `20px`, shadow `0 8px 40px rgba(0,0,0,0.12)`, overflow hidden. Compact widget: max-width `100%`, radius `14px`, shadow `0 4px 20px rgba(0,0,0,0.1)`.

Header: background `#1a1916`; full padding `20px 24px`, compact padding `16px 18px`; flex row with space-between. Title is full `16px/700 #ffffff`, compact `13px/700 #ffffff`. Subtitle is `11px rgba(255,255,255,0.5)`, margin-top `2px`. Step dots are `6px` circles with `4px` gap; active dot `#2ea69f`, inactive `rgba(255,255,255,0.2)`.

Body padding: full `20px 24px`, compact `16px 18px`.

### Flow

The widget has three steps: `Select Date`, `Guests`, `Confirm Booking`. Navigation labels use `Next: Guests`, `Next: Confirm`, and final `Book Now · $total`. Back buttons use secondary styling; forward buttons use primary styling.

Section labels inside widget are uppercase, `12px/600 #7d7970`, letter spacing `0.08em`, margin-bottom `10px-14px`.

Date chips: flex wrap, gap `6px`, margin-bottom `16px`; padding `6px 12px`, radius `7px`, font `12px`. Selected date uses border `1.5px solid #1e8f88`, background `#1e8f88`, text `#ffffff`, weight `600`. Unselected uses border `1.5px solid #e4e2de`, background `#ffffff`, text `#3e3b37`, weight `400`.

Time chips: padding `7px 14px`, radius `7px`, font `12px`. Selected time uses border `1.5px solid #1e8f88`, background `#eef7f6`, text `#177870`, weight `600`; unselected matches date unselected style.

Guest rows: padding `10px 0`, first row bottom border `1px solid #f1f0ee`. Label `13px/500 #1a1916`; subtext `11px #a8a49c`. Controls use compact number steppers described above.

Confirmation summary: background `#f8f8f7`, radius `10px`, padding `12px 14px`, margin-bottom `14px`; rows are flex space-between with `12px` font. Keys use `#7d7970`; values use `#1a1916` and weight `600`.

Confirmation inputs inside widget are smaller: padding `9px 12px`, border `1.5px solid #e4e2de`, radius `8px`, font `12px`, focus border `#2ea69f`.

## Calendar, Availability, and Booking Controls

Calendar cards use background `#ffffff`, border `1px solid #e4e2de`, radius `12px`, padding `20px`. Month header is centered `14px/600 #1a1916`; arrow buttons are borderless, transparent, `16px`, color `#5c5852`.

Day-of-week labels are `11px/600 #a8a49c`, letter spacing `0.04em`, padding-bottom `8px`. Date cells use square aspect ratio, radius `7px`, font `12px`, transition `all 0.1s`, pointer cursor. Available/selected dates use background `#1e8f88`, text `#ffffff`, weight `600`. Today uses background `#f1f0ee`, text `#1a1916`. Default dates use transparent background and text `#3e3b37`.

Time-slot sidebar: width `130px`, flex column, gap `6px`. Label is uppercase `11px/600 #7d7970`, letter spacing `0.08em`. Slot button padding `9px 14px`, radius `8px`, font `13px`, text-align center. Selected slot background `#1e8f88`, text `#ffffff`, weight `600`, transparent border. Unselected background `#f8f8f7`, text `#3e3b37`, border `1px solid #e4e2de`.

Mini availability calendars use date radius `5px`, font `11px`, gap `3px`. Full dates use background `#1e8f88`, text `#ffffff`; booked dates use background `#cceae7`, text `#177870`; open dates are transparent with text `#3e3b37`. Legend dots are `10px` square with radius `3px`.

## Add-On and Selector Styles

Add-on rows use flex alignment, gap `14px`, padding `13px 16px`, radius `10px`, border `1.5px solid #e4e2de`, background `#ffffff`, transition `all 0.15s`, cursor pointer. Selected rows use border `#2ea69f` and background `#eef7f6`.

Add-on icon box is `36px` square, radius `8px`; selected background `#cceae7`, icon `#177870`; unselected background `#f1f0ee`, icon `#a8a49c`. Title is `13px/600 #1a1916`; description `11px #7d7970`; price `14px/700`, selected `#1e8f88`, unselected `#5c5852`. Check control is `20px` circle with `2px` border; selected border/background `#1e8f88` and white check.

Guest selector container uses background `#ffffff`, border `1px solid #e4e2de`, radius `12px`, overflow hidden. Rows use padding `14px 18px`, separators `1px solid #f1f0ee`; footer uses padding `10px 18px`, background `#f8f8f7`, border-top `1px solid #f1f0ee`, text `12px #7d7970`.

## Mobile Layout Rules

Mobile examples are rendered at `320px` viewport width with `560px` content height inside a device frame. Use these as minimum mobile behavior targets.

Operator mobile dashboard: background `#f8f8f7`, full height, scrollable. Header background `#1a1916`, padding `16px 18px 20px`; eyebrow `13px rgba(255,255,255,0.5)`, title `20px/700 #ffffff`, letter spacing `-0.3px`. Content padding `16px 14px`, flex column gap `14px`.

Mobile stat grid: two columns, gap `10px`; stat card background `#ffffff`, border `1px solid #e4e2de`, radius `12px`, padding `14px 16px`; label `11px #7d7970`; value `22px/700 #1a1916`, letter spacing `-0.5px`; delta `11px/600 #1a9e6e`.

Mobile booking list: card background `#ffffff`, border `1px solid #e4e2de`, radius `12px`, overflow hidden. Header padding `12px 14px`, bottom border `1px solid #f1f0ee`, title `13px/600 #1a1916`. Rows use gap `10px`, padding `10px 14px`; avatar `32px`; row title `12px/600`; metadata `11px #7d7970`; badge `10px/600`, padding `2px 7px`.

Mobile booking widget page: background `#f8f8f7`, padding `16px`, scrollable. Page title `16px/700 #1a1916`, margin-bottom `4px`; subtitle `12px #7d7970`, margin-bottom `16px`. Embed the compact booking widget variant.

Responsive behavior inferred from source: collapse desktop multi-column sections to vertical stacks on narrow screens, use bottom navigation instead of the desktop sidebar for operator mobile views, keep primary actions full width inside the booking widget, and keep chip groups wrapping with `6px` gaps rather than forcing horizontal overflow.
