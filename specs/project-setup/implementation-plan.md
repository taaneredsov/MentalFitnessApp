# Implementation Plan: Project Setup

## Overview

Set up a React + Vite project with Tailwind CSS, shadcn/ui, and PWA capabilities. The project will be structured for Vercel deployment with serverless functions support.

## Phase 1: Initialize React + Vite Project

Create the base React project with TypeScript and configure the initial project structure.

### Tasks

- [ ] Initialize Vite project with React + TypeScript template
- [ ] Update package.json with project name and description
- [ ] Create folder structure for the app
- [ ] Configure TypeScript with strict mode and path aliases

### Technical Details

**Initialize project:**
```bash
npm create vite@latest . -- --template react-ts
npm install
```

**Folder structure to create:**
```
src/
├── components/      # Shared UI components
├── pages/           # Page components
├── lib/             # Utilities and helpers
├── hooks/           # Custom React hooks
├── types/           # TypeScript type definitions
├── api/             # API client functions
└── assets/          # Static assets (images, fonts)
api/                 # Vercel serverless functions
public/              # PWA icons and static files
```

**tsconfig.json path aliases:**
```json
{
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**vite.config.ts alias configuration:**
```typescript
import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
```

## Phase 2: Install and Configure Tailwind CSS

Set up Tailwind CSS v3 with PostCSS for styling.

### Tasks

- [ ] Install Tailwind CSS, PostCSS, and Autoprefixer
- [ ] Initialize Tailwind configuration
- [ ] Configure tailwind.config.js with content paths
- [ ] Add Tailwind directives to main CSS file
- [ ] Verify Tailwind works with a test class

### Technical Details

**Install Tailwind:**
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**tailwind.config.js:**
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**src/index.css:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

## Phase 3: Set Up shadcn/ui

Install and configure shadcn/ui component library with initial components.

### Tasks

- [ ] Install shadcn/ui CLI and initialize
- [ ] Configure components.json for the project
- [ ] Install Button component as baseline
- [ ] Install additional core components (Card, Input, Label)
- [ ] Verify components render correctly

### Technical Details

**Initialize shadcn/ui:**
```bash
npx shadcn@latest init
```

**Configuration choices for shadcn init:**
- Style: Default
- Base color: Slate (or Zinc for neutral)
- CSS variables: Yes
- Tailwind config: tailwind.config.js
- Components alias: @/components
- Utils alias: @/lib/utils

**Install core components:**
```bash
npx shadcn@latest add button card input label
```

**components.json (generated):**
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

## Phase 4: Configure PWA

Set up Progressive Web App capabilities with vite-plugin-pwa.

### Tasks

- [ ] Install vite-plugin-pwa
- [ ] Configure PWA plugin in vite.config.ts
- [ ] Create PWA icons (192x192, 512x512) as placeholders
- [ ] Configure web app manifest with app details
- [ ] Add service worker registration
- [ ] Configure offline fallback page

### Technical Details

**Install PWA plugin:**
```bash
npm install -D vite-plugin-pwa
```

**vite.config.ts with PWA:**
```typescript
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"
import path from "path"

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png"],
      manifest: {
        name: "Corporate Mental Fitness",
        short_name: "Mental Fitness",
        description: "Corporate Mental Fitness Program App",
        theme_color: "#0f172a",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png"
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.airtable\.com\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "airtable-api-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 // 1 hour
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
```

**PWA icons to create in /public:**
- pwa-192x192.png (192x192 placeholder)
- pwa-512x512.png (512x512 placeholder)
- apple-touch-icon.png (180x180 for iOS)
- favicon.ico

**Add to index.html <head>:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<meta name="theme-color" content="#0f172a" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

## Phase 5: Environment Variables and Vercel Structure

Configure environment handling and prepare for Vercel serverless functions.

### Tasks

- [ ] Install dotenv for local development
- [ ] Create .env.example with required variables (without values)
- [ ] Update .gitignore to exclude env files
- [ ] Create /api folder structure for Vercel serverless functions
- [ ] Create a health check API endpoint to verify serverless setup
- [ ] Create vercel.json configuration

### Technical Details

**.env.example:**
```
# Airtable Configuration
AIRTABLE_API_KEY=
AIRTABLE_BASE_ID=
AIRTABLE_TABLE_ID=

# JWT Configuration (to be added in auth-system)
JWT_SECRET=

# App Configuration
VITE_APP_NAME=Corporate Mental Fitness
```

**Note:** Environment variables prefixed with `VITE_` are exposed to the client. Keep sensitive keys (AIRTABLE_API_KEY, JWT_SECRET) without the prefix.

**/api/health.ts (Vercel serverless function):**
```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node"

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString()
  })
}
```

**Install Vercel types:**
```bash
npm install -D @vercel/node
```

**vercel.json:**
```json
{
  "rewrites": [
    { "source": "/((?!api/.*).*)", "destination": "/index.html" }
  ]
}
```

## Phase 6: Create Base App Component

Set up the main App component with a simple layout to verify everything works.

### Tasks

- [ ] Clean up default Vite boilerplate (App.tsx, App.css)
- [ ] Create a simple App component using shadcn Button
- [ ] Add basic mobile-first styling
- [ ] Verify the app runs and displays correctly
- [ ] Test PWA installation on mobile device or Chrome DevTools

### Technical Details

**src/App.tsx:**
```typescript
import { Button } from "@/components/ui/button"

function App() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">
          Corporate Mental Fitness
        </h1>
        <p className="text-muted-foreground mb-4">
          Project setup complete. Ready for next features.
        </p>
        <Button>Get Started</Button>
      </main>
    </div>
  )
}

export default App
```

**Verification steps:**
1. Run `npm run dev` - app should start without errors
2. Open browser DevTools > Application > Manifest - should show PWA config
3. Open browser DevTools > Application > Service Workers - should show registered worker
4. On mobile or Chrome DevTools mobile view, verify "Add to Home Screen" works
