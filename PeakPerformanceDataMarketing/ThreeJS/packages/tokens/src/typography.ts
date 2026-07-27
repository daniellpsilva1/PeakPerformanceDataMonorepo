export const fontFamilies = {
  body: "Inter",
  bodyFallback: "Helvetica Neue, Arial, sans-serif",
  condensed: "Barlow Condensed",
  condensedFallback: "Arial Narrow, sans-serif",
} as const;

export const fontWeights = {
  bold: 700,
  medium: 500,
  regular: 400,
  semibold: 600,
} as const;

export const typography = {
  families: fontFamilies,
  weights: fontWeights,
} as const;
