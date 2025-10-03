# JustSeventy Logo Assets

## Required Logo Files

Replace the placeholder SVG files with your actual logo files:

### Light Logo (for white/light backgrounds)
- **File**: `js-logo-light.png` (or `.svg`)
- **Dimensions**: ~240×60px
- **Usage**: Admin UI headers, print exports
- **Retina**: `js-logo-light@2x.png` (480×120px)

### Dark Logo (for dark/image backgrounds)
- **File**: `js-logo-dark.png` (or `.svg`)
- **Dimensions**: ~240×60px
- **Usage**: Client view with backgrounds
- **Retina**: `js-logo-dark@2x.png` (480×120px)

## Current Placeholder Files

The current `.svg` files are placeholders and should be replaced with your brand assets:
- `js-logo-light.svg` - Dark text for light backgrounds
- `js-logo-dark.svg` - White text for dark backgrounds

## Logo Configuration

Logo paths are configured in:
```
src/config/brand.ts
```

Update the `BRAND` object if you change file formats or paths:
```typescript
export const BRAND = {
  logoLight: '/assets/js-logo-light.png',  // Update format here
  logoDark: '/assets/js-logo-dark.png',
  logoLightRetina: '/assets/js-logo-light@2x.png',
  logoDarkRetina: '/assets/js-logo-dark@2x.png',
  name: 'JustSeventy',
};
```

## Logo Display Locations

1. **Admin Timeline List** - Light logo in sticky header
2. **Admin Timeline Detail** - Light logo in sticky header
3. **Client Public View** - Auto-switches based on background brightness
4. **Print/PDF Export** - Light logo in header with event details
5. **Mobile Views** - Responsive sizing (28px on small screens)

## Automatic Contrast Detection

The client view automatically detects background brightness and switches between light/dark logos for optimal visibility.
