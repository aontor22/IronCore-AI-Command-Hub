# IronCore Favicon Add Guide

## Files included

- favicon.svg
- favicon.ico
- favicon-16x16.png
- favicon-32x32.png
- apple-touch-icon.png
- android-chrome-192x192.png
- android-chrome-512x512.png
- site.webmanifest

## Where to place the files

Copy all favicon files into your Vite project `public/` folder.

Final structure:

```text
public/
├── favicon.svg
├── favicon.ico
├── favicon-16x16.png
├── favicon-32x32.png
├── apple-touch-icon.png
├── android-chrome-192x192.png
├── android-chrome-512x512.png
└── site.webmanifest
```

If your project does not have a `public/` folder, create one at the same level as `src/`, `package.json`, and `index.html`.

## Update index.html

Open `index.html` and place these lines inside the `<head>` tag:

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />
<meta name="theme-color" content="#00e5ff" />
```

## Optional: update browser title

Inside `index.html`, update:

```html
<title>IronCore AI Command Hub</title>
```

## Vercel redeploy

After pushing the favicon files and `index.html` changes to GitHub:

1. Go to Vercel
2. Open your project
3. Go to Deployments
4. Click Redeploy on the latest production deployment

## Browser cache note

Favicons are heavily cached by browsers. If the old icon still shows:

- Hard refresh the page with Ctrl + F5
- Open the site in an Incognito window
- Or wait a few minutes after redeploy
