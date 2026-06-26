# dxf-vuer demo

Demo application for the [dxf-vuer](https://www.npmjs.com/package/dxf-vuer) library. Deployed at [dxf-kit.netlify.app](https://dxf-kit.netlify.app).

## Running Locally

From the repository root:

```bash
pnpm install
pnpm dev
```

Opens at `http://localhost:5173`.

## Building

```bash
pnpm build:demo
```

Output goes to `dist-demo/`.

## What It Shows

- File upload and DXF rendering via `<DXFViewer>`
- Layer visibility panel
- Unsupported entity list
- File statistics (entity counts, layers, blocks, AutoCAD version)
