# Friendship Day | The Chat That Never Ends

A cinematic, single-page Friendship Day experience built with React + TypeScript + Vite. The app simulates a WhatsApp-like chat timeline with storytelling scenes, motion, confetti moments, and a contact profile panel.

## Highlights

- Multi-scene flow: intro lockscreen -> chat timeline -> ending -> finale.
- Scripted chat playback with typing indicators, date separators, status rows, and image messages.
- WhatsApp-style in-phone UI (status bar, chat header, bubbles, composer, wallpaper).
- Contact profile overlay opened by tapping the chat name/avatar.
- Profile actions show an unavailable toast message.
- Background chat progression pauses while profile overlay is open.
- Finale reveal with confetti and line-by-line message animation.

## Tech Stack

- React 19 + TypeScript
- Vite 8
- Framer Motion (scene and element transitions)
- GSAP (phone-scale finale effect)
- canvas-confetti (celebration effect)
- Lucide React (icons)
- Tailwind CSS v4 + custom CSS

## Project Structure

```text
.
|- public/
|  |- frnd_favicon1.png
|  |- frndssss.jpg
|  `- ...
|- src/
|  |- App.tsx        # Main story engine, UI flow, interactions
|  |- index.css      # Full visual system and animation styles
|  |- main.tsx       # App bootstrap
|  `- vite-env.d.ts
|- index.html
|- package.json
`- README.md
```

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Run in development

```bash
npm run dev
```

### 3. Build for production

```bash
npm run build
```

### 4. Preview production build

```bash
npm run preview
```

## Available Scripts

- `npm run dev` - start Vite dev server
- `npm run build` - create production build
- `npm run preview` - preview built output locally
- `npm run lint` - run ESLint

## Notes

- Favicon is configured in `index.html` and currently points to `/frnd_favicon1.png`.
- Main interaction/state logic is intentionally centralized in `src/App.tsx` for easier iteration on storytelling behavior.
