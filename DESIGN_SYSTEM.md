# Drape & Drop — Mobile design direction

Android first. Warm ivory (#F7F5F0), charcoal (#272923), muted sage (#52604C), taupe borders (#DEDCD3). Shared native tokens live in mobile/src/theme/tokens.ts.

Use generous spacing, scalable text, 48dp minimum touch targets, visible disabled states and natural Android back navigation. Use React Native StyleSheet rather than the old web Tailwind theme.

The initial implementation uses the Android system body font and system serif for display. The Figma direction explores Inter and Cormorant Garamond; final custom font integration awaits visual review. The Material button in Figma is a reference instance; the native button is implemented in mobile/src/components/Button.tsx.

[Figma mobile direction](https://www.figma.com/design/IOurQ8W4mZAxVONkjql8uq?node-id=2-663)

Static editorial imagery may illustrate the introduction. Never portray static fashion imagery as a user wardrobe, recommendation, or generated try-on result.
