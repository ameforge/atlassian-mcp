---
name: Atlassian
source: https://atlassian.com/
colors:
  primary: "#1868db"
  secondary: "#ffab00"
  accent: "#3860be"
  background: "#ffffff"
  surface-raised: "#f8f8f8"
  foreground: "#101214"
  neutral: "#292a2e"
  border: "#dddee1"
typography:
  display:
    fontSize: 128px
    fontWeight: 700
  headline:
    fontSize: 54px
    fontWeight: 500
    lineHeight: 56.16px
  title:
    fontSize: 28px
    fontWeight: 500
    lineHeight: 34.72px
  body:
    fontFamily: Charlie Text
    fontSize: 16px
    lineHeight: normal
rounded:
  xs: 1px
  sm: 4px
  md: 8px
  lg: 15px
  xl: 24px
  pill: 100px
spacing:
  base: 4px
---

# Design System: Atlassian

## Overview

Visual reference taken from the atlassian.com homepage. The voice is friendly and speaks to the reader as "you"; headings are short and in Sentence case.

## Colors

| role           | hex       |
| -------------- | --------- |
| primary        | `#1868db` |
| secondary      | `#ffab00` |
| accent         | `#3860be` |
| background     | `#ffffff` |
| surface-raised | `#f8f8f8` |
| foreground     | `#101214` |
| neutral        | `#292a2e` |
| border         | `#dddee1` |

Primary is the color on the site's interactive elements. Other neutrals: `#505258` · `#696969` · `#42526e`

### Contrast pairs

| pair             | bg        | fg        | contrast    |
| ---------------- | --------- | --------- | ----------- |
| page             | `#ffffff` | `#101214` | 18.77:1 AAA |
| raised           | `#f8f8f8` | `#101214` | 17.68:1 AAA |
| primary action   | `#1868db` | `#ffffff` | 5.2:1 AA    |
| secondary action | `#ffab00` | `#101214` | 9.9:1 AAA   |
| accent action    | `#3860be` | `#ffffff` | 5.86:1 AA   |

## Typography

- Families: `Charlie Text` (body), `Charlie Display`, `Atlassian Mono`.
- Body: `16px`, line-height `normal`, about 76 characters per line.
- Scale ratio `1.125` from `14px`.

| role        | size    | weight | line-height |
| ----------- | ------- | ------ | ----------- |
| display     | `128px` | `700`  | `normal`    |
| h1          | `54px`  | `500`  | `56.16px`   |
| h2          | `40px`  | `500`  | `46.4px`    |
| h3          | `28px`  | `500`  | `34.72px`   |
| title       | `24px`  | `400`  | `normal`    |
| small title | `20px`  | `400`  | `31.2px`    |

## Layout

- Spacing on a `4px` grid: `4` · `8` · `12` · `16` · `20` · `24` · `32` · `40` · `48` · `60` px.
- Content column `912px`, sections padded `40px` vertically.

## Elevation & Depth

Neutral shadows:

- `xs`: `rgb(128, 128, 128) 0px 0px 5px 0px`
- `sm`: `rgb(199, 197, 199) -3px -3px 5px -2px`
- `md`: `rgba(30, 31, 33, 0.15) 0px 8px 12px 0px, rgba(30, 31, 33, 0.31) 0px 0px 1px 0px`

## Shapes

Radii `1` · `4` · `8` · `15` · `24` px; buttons are pills. Borders are `1px` hairlines in `#dddee1`.

## Components

### Buttons

Pill shaped, heights `20` · `40` · `60` px, darken on hover.

| variant     | fill      | text      | radius  |
| ----------- | --------- | --------- | ------- |
| solid dark  | `#101214` | `#ffffff` | `100px` |
| solid light | `#f8f8f8` | `#000000` | `50px`  |
| ghost       | none      | `#000000` | `100px` |

## Do's and Don'ts

### Do:

- Write headings in Sentence case and keep them short.
- Address the reader as "you".
- Keep primary blue for actions.

### Don't:

- Don't spread type across many sizes; the source uses 23.
- Don't override styles with `!important`.
