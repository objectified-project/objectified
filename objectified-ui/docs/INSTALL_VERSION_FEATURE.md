# Installation Instructions for Version & What's New Feature

## Quick Start

Run the following command to install the new dependencies:

```bash
npm install react-markdown@^9.0.1 remark-gfm@^4.0.0 rehype-raw@^7.0.0 @types/react-markdown@^9.0.0 --save
```

Or if you're using a different package manager:

### Yarn
```bash
yarn add react-markdown@^9.0.1 remark-gfm@^4.0.0 rehype-raw@^7.0.0 @types/react-markdown@^9.0.0
```

### pnpm
```bash
pnpm add react-markdown@^9.0.1 remark-gfm@^4.0.0 rehype-raw@^7.0.0 @types/react-markdown@^9.0.0
```

### bun
```bash
bun add react-markdown@^9.0.1 remark-gfm@^4.0.0 rehype-raw@^7.0.0 @types/react-markdown@^9.0.0
```

## What Was Changed

1. **Added Version Badge**: A clickable version badge now appears next to the Objectified logo
2. **What's New Dialog**: Clicking the version badge opens a modal with release notes
3. **Markdown Support**: Release notes are written in Markdown with full GFM support
4. **Dark Mode**: Fully styled for both light and dark themes

## Files to Review

- `src/app/components/ade/TopHeader.tsx` - Updated header with version badge
- `src/app/components/ade/WhatsNewDialog.tsx` - New dialog component
- `public/WHATS_NEW.md` - Release notes content (customizable)
- `docs/VERSION_WHATS_NEW_FEATURE.md` - Complete feature documentation

## Testing

After installing dependencies:

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to any page under `/ade` (e.g., Dashboard or Studio)

3. Look for the version badge (e.g., "v0.1.0") next to the logo

4. Click the version badge to see the What's New dialog

5. Try closing it by clicking the X or clicking outside the dialog

## Customizing

### Update Version Number

Edit both files to keep them in sync:
- `package.json` - Update `"version"` field
- `src/app/components/ade/TopHeader.tsx` - Update `APP_VERSION` constant

### Update Release Notes

Edit `public/WHATS_NEW.md` with your content. You can use:
- Markdown formatting
- Images (place in `/public` folder)
- Links (external links open in new tabs)
- Code blocks
- Tables and more

Example:
```markdown
# What's New in v0.2.0

## New Features

![New Feature](/images/feature-screenshot.png)

We've added amazing new capabilities:
- Feature 1
- Feature 2

[Read full documentation](/docs)
```

## Troubleshooting

If you see TypeScript errors about missing modules, ensure you've installed all dependencies:

```bash
npm install
```

If the dialog doesn't render properly, check that:
- All files were created correctly
- No compilation errors exist
- The markdown file exists at `public/WHATS_NEW.md`

## Next Steps

Consider enhancing the feature with:
- Automatic version detection from package.json
- "New" badge for unread release notes
- Version history with multiple releases
- Localization support

See `docs/VERSION_WHATS_NEW_FEATURE.md` for more details.

