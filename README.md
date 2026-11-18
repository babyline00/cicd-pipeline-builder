# AI-Powered CI/CD Pipeline Builder

> Visual + AI-generated CI/CD pipelines. Drag-and-drop a node graph, ask the
> LLM to generate one from a description, compile to GitHub Actions YAML with
> smart caching + matrix expansion, and run a deterministic mock simulation
> — all without installing React Flow.

Project #95 in the 110-project portfolio plan. Rebuilt fresh after the
sandbox recycle. Built with Next.js 16, TypeScript 5, Tailwind 4, shadcn/ui,
Prisma 6 + SQLite, and the `z-ai-web-dev-sdk`.

---

## MVP scope (delivered)

- **Visual pipeline builder** — a custom SVG canvas (no React Flow). Drag
  node types from the palette onto the canvas, click to select, drag to
  move, click an edge to delete. 14 node types:
  `trigger`, `checkout`, `setup-node`, `setup-python`, `setup-go`,
  `install`, `lint`, `test`, `build`, `deploy-vercel`, `deploy-fly`,
  `deploy-aws`, `notify-slack`, `notify-email`.
- **AI-generated graph from description** — type a natural-language
  description ("Build a Node.js CI that runs on push to main: install, lint,
  test, build, deploy to Vercel.") and the LLM returns a JSON node graph
  that replaces the canvas. Falls back to a minimal valid graph if the LLM
  response is unparseable.
- **YAML output** — "Generate YAML" compiles the current graph to GitHub
  Actions YAML. Shown in a code block with a "Copy" button.
- **Smart caching** — the compiler auto-inserts `cache: 'npm'` on
  `setup-node`, `cache: 'pip'` on `setup-python`, and `cache: true` on
  `setup-go` (when the cache manager isn't `'none'`).
- **Matrix builds** — a node's `matrix` property (e.g.
  `{ "node-version": [18, 20, 22] }`) is collected across all setup/test
  nodes and emitted as a `strategy.matrix` block at the job level. Steps
  reference `${{ matrix.node-version }}` instead of a literal version.
- **Secrets management** — UI to declare secrets (name + description).
  YAML references them as `${{ secrets.NAME }}`. Names are validated as
  UPPER_SNAKE_CASE on the way in.
- **Live run + debug (mock)** — "Simulate run" walks the graph in
  topological order and produces a deterministic mock log per node
  (deterministic = same graph → same logs, used for snapshot tests and a
  reproducible UI). Displayed in a terminal-style view at the bottom.
- **Save / load pipelines** — persist to SQLite via Prisma. The header
  has "Save", "Load", and "New" buttons.

## Stretch goals (not delivered)

- Real GitHub Actions API push (commit the YAML to a repo + trigger a
  workflow run via the Actions REST API).
- Multi-platform CI (run on `ubuntu-latest`, `macos-latest`,
  `windows-latest`).
- Multi-job pipelines (the MVP emits a single `build` job — multi-job is a
  natural follow-on now that the YAML compiler is in place).
- React Flow instead of the custom SVG canvas (heavier dependency, but
  better UX: bend points, mini-map, keyboard shortcuts).
- Cost optimization: skip LLM call when the cached graph description
  matches, share `yamlCache` across runs.

---

## Features

- Single-page app at `/`. Header + palette + canvas + right panel +
  simulation terminal.
- Right panel has three tabs: **Properties**, **YAML**, **Secrets**.
- Palette groups node types by category (Trigger, Source, Setup, Build,
  Deploy, Notify).
- Auto-connect: dropping a node on the canvas connects it to the
  topologically-last existing node.
- Add edge from the properties panel (select source node + target node
  from a dropdown).
- Live stats: pipeline count + simulation count from `/api/stats`.
- Toast notifications via `sonner`.
- Light/dark theme support via `next-themes` (CSS variables only).
- Responsive layout (palette collapses on narrow viewports; canvas +
  terminal remain usable).

---

## Tech stack

| Layer        | Choice                                              |
| ------------ | --------------------------------------------------- |
| Framework    | Next.js 16 (App Router, single route `/`)            |
| Language     | TypeScript 5 (strict)                              |
| Styling      | Tailwind CSS 4 + shadcn/ui (New York)               |
| UI primitives| Radix UI + lucide-react icons                      |
| Database     | Prisma 6 + SQLite (`db/custom.db`)                 |
| AI           | `z-ai-web-dev-sdk` (non-streaming `complete()`)    |
| Canvas       | Custom inline SVG (no React Flow)                  |
| Tests        | `bun test` (Bun's built-in test runner)             |
| Lint         | `eslint-config-next`                               |

> React Flow is intentionally NOT installed — the canvas is a hand-rolled
> inline SVG with HTML5 drag-and-drop. This keeps the bundle small and
> demonstrates how to build a node editor from primitives.

---

## Architecture

```
                ┌──────────────────────────────────────────────┐
                │                  Browser (/)                  │
                │  ┌─────────────┐  ┌────────┐  ┌─────────────┐ │
                │  │ Node palette│  │  SVG   │  │ Right panel │ │
                │  │ (HTML5 DnD) │→ │ canvas │← │ Props/YAML/ │ │
                │  └─────────────┘  └────────┘  │ Secrets tab │ │
                │                                  └─────────────┘│
                │  ┌──────────────────────────────────────────────┐│
                │  │ Simulation terminal (deterministic mock logs)││
                │  └──────────────────────────────────────────────┘│
                └────────────┬─────────────────────────────────────┘
                             │ fetch (relative paths)
                             ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │                      Next.js API routes                          │
   │  POST   /api/pipelines                  GET /api/pipelines        │
   │  GET/PATCH/DELETE /api/pipelines/[id]   GET /api/node-types      │
   │  POST   /api/pipelines/[id]/secrets     DELETE /api/secrets/[id] │
   │  POST   /api/pipelines/[id]/generate-yaml                       │
   │  POST   /api/pipelines/[id]/generate-from-description           │
   │  POST   /api/pipelines/[id]/simulate  GET /api/stats             │
   └────────────┬───────────────────────┬──────────────────────────┘
                │                       │
                ▼                       ▼
   ┌──────────────────────┐  ┌────────────────────────────────┐
   │ Prisma 6 + SQLite    │  │ Pure libs (no I/O)              │
   │ db/custom.db         │  │  yaml-compiler.ts               │
   │  Pipeline            │  │  node-types.ts (registry)        │
   │  Secret              │  │  graph-validator.ts (toposort)   │
   │  Simulation          │  │  matrix.ts (expansion)          │
   └──────────────────────┘  │  secrets.ts (naming)            │
                             │  simulate.ts (mock logs)         │
                             │  llm-graph-generator.ts          │
                             │  ai.ts (LLM provider)            │
                             └────────────────────────────────┘
                                          │
                                          ▼
                             ┌────────────────────────────────┐
                             │ z-ai-web-dev-sdk (server-only)  │
                             │ chat.completions.create          │
                             └────────────────────────────────┘
```

---

## Setup

```bash
# 1. Install deps
bun install

# 2. Create the SQLite database + generate Prisma client
bun run db:push

# 3. (optional) Seed nothing — start the canvas empty

# 4. Start the dev server
bun run dev
#  → http://localhost:3000  (open in the Preview Panel)

# 5. Run tests
bun test

# 6. Lint
bun run lint
```

> The `db:push` script inlines `DATABASE_URL="$(pwd)/db/custom.db"` so the
> SQLite file lives inside this project's `db/` folder and is isolated from
> the parent project.

---

## Tests

```bash
bun test
```

45+ tests across 7 files in `src/lib/__tests__/`:

| File                         | Coverage                                                    |
| ---------------------------- | ----------------------------------------------------------- |
| `yaml-compiler.test.ts`      | trigger→on, checkout→uses, setup-node→version+cache, install/lint/test/build→run, deploy→secrets ref, matrix expansion, secrets block, `assertYamlLooksValid` |
| `node-types.test.ts`         | `getNodeTypes`, every type has id/label/color/props/schema, `getNodeType`, `isValidNodeType`, `validateNode`, `makeNode`, `NODE_CATEGORIES` |
| `graph-validator.test.ts`    | empty graph invalid, no trigger invalid, cycle invalid, self-loop invalid, valid graph ok, `topologicalSort`, `isAcyclic` |
| `llm-graph-generator.test.ts`| `buildGenerateGraphPrompt` (description + node schema + JSON instructions), `parseGraphResponse` (fenced + bare + invalid + unknown type filter), `normalizeGraph`, `generateGraphFromDescription` (mock LLM) |
| `simulate.test.ts`           | deterministic logs, every node appears, trigger mentions event, deploy mentions "deployed", `formatLogsAsText` |
| `secrets.test.ts`            | `validateSecretName` UPPER_SNAKE_CASE, `formatSecretsRef`, `extractSecretRefs` |
| `matrix.test.ts`             | `expandMatrix` single/multi-axis, `hasMatrix`, `getMatrixAxes`, `matrixYamlBlock`, `collectMatrixAxes` |

The LLM provider is mocked in tests (`__setLlmProviderForTest`) so the
suite runs fully offline without touching the `z-ai-web-dev-sdk`.

---

## Environment variables

Copy `.env.example` to `.env`:

```bash
# Prisma SQLite database (absolute path — required)
DATABASE_URL=file:/home/z/my-project/apps/95-cicd-pipeline-builder/db/custom.db

# Optional: disable real LLM and use the mock provider
# PKC_DISABLE_LLM=1
# CICD_DISABLE_LLM=1
```

The `z-ai-web-dev-sdk` is configured via the sandbox environment; no
extra keys are required in `.env` for it to work.

---

## Project structure

```
95-cicd-pipeline-builder/
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── tailwind.config.ts
├── components.json
├── eslint.config.mjs
├── .env.example
├── .gitignore
├── LICENSE
├── README.md
├── prisma/
│   └── schema.prisma            # Pipeline, Secret, Simulation
├── db/
│   └── custom.db                # SQLite (gitignored)
└── src/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx              # The whole UI (palette + canvas + panel + terminal)
    │   ├── globals.css          # Tailwind 4 + terminal + canvas-grid styles
    │   └── api/
    │       ├── pipelines/
    │       │   ├── route.ts                              # POST, GET list
    │       │   └── [id]/
    │       │       ├── route.ts                          # GET, PATCH, DELETE
    │       │       ├── secrets/route.ts                  # POST, GET
    │       │       ├── generate-yaml/route.ts            # POST
    │       │       ├── generate-from-description/route.ts# POST
    │       │       └── simulate/route.ts                 # POST
    │       ├── secrets/[id]/route.ts                    # DELETE
    │       ├── node-types/route.ts                       # GET
    │       └── stats/route.ts                           # GET
    ├── components/ui/           # 13 shadcn/ui components (copied from parent)
    └── lib/
        ├── ai.ts                # LlmProvider (ZaiProvider + MockProvider)
        ├── db.ts                # Prisma client singleton
        ├── utils.ts             # cn() + shortId()
        ├── node-types.ts        # NODE_TYPES registry (single source of truth)
        ├── secrets.ts           # validateSecretName, formatSecretsRef
        ├── matrix.ts            # expandMatrix, matrixYamlBlock, collectMatrixAxes
        ├── graph-validator.ts   # validateGraph, topologicalSort, detectCycle
        ├── yaml-compiler.ts     # compileToYaml (pure function)
        ├── simulate.ts          # simulateRun (deterministic mock)
        ├── llm-graph-generator.ts # buildGenerateGraphPrompt, parseGraphResponse
        └── __tests__/
            ├── yaml-compiler.test.ts
            ├── node-types.test.ts
            ├── graph-validator.test.ts
            ├── llm-graph-generator.test.ts
            ├── simulate.test.ts
            ├── secrets.test.ts
            └── matrix.test.ts
```

---

## Case study — design decisions worth flagging

### 1. Custom SVG canvas instead of React Flow

The spec said "DO NOT install React Flow". I built a hand-rolled inline
SVG canvas with HTML5 drag-and-drop: nodes are `<g>` with `<rect>` +
`<text>`, edges are cubic-bezier `<path>` with an invisible thick hit-area
path for easy click-to-delete. Node dragging uses `getScreenCTM().inverse()`
to convert pixel deltas into SVG coordinates so the math stays correct at
any viewBox/pixel ratio.

Trade-off: ~250 lines of canvas code vs. ~5 lines of React Flow. But zero
new dependencies and full control over the look. If I shipped this for
real, I'd reach for React Flow the moment I needed bend points, a
mini-map, or keyboard shortcuts — but for an MVP visual that compiles to
YAML, the SVG approach is fine.

### 2. Smart caching is automatic

The YAML compiler always emits a `cache:` line on `setup-node` /
`setup-python` (default `'npm'` / `'pip'`), and `cache: true` on
`setup-go` when the cache manager isn't `'none'`. The user never has to
think about caching — it's just there. The `matrix` axis collection is
similar: any node that declares a `matrix` prop contributes to the
job-level `strategy.matrix` block, and the matching step references
`${{ matrix.axis }}` instead of a literal version. One mental model,
zero boilerplate.

### 3. Matrix expansion is pure + tested

`expandMatrix(node)` in `matrix.ts` is a pure function that returns the
cartesian product of all axes declared on the node. It's used by the YAML
compiler to emit the `strategy.matrix` block. Tests cover single-axis,
multi-axis, empty/missing matrix, string values, and axis collection
across multiple nodes.

### 4. Deterministic simulation

`simulateRun(graph)` in `simulate.ts` walks the graph in topological
order and produces a mock log per node. The RNG seed is derived from the
node id (`hashString(node.id)`) so the same graph always produces the
same logs. This makes the simulator snapshot-testable and gives the UI a
reproducible "Simulate run" button — useful for demos and regression
tests.

### 5. LLM is mockable end-to-end

`ai.ts` exposes `LlmProvider` + `__setLlmProviderForTest`. The
`MockProvider` echoes the user prompt; tests swap in a mock that returns
a JSON graph in a fenced code block. The real `ZaiProvider` calls
`zai.chat.completions.create({ stream: false })`. The whole chain
(prompt → LLM → parse → normalize → graph) is exercised by tests without
ever hitting the network.

### 6. Single source of truth for node types

`src/lib/node-types.ts` is the registry. The SVG canvas, properties
panel, YAML compiler, simulator, LLM prompt builder, and `/api/node-types`
route all read from this one array. Adding a new node type is a one-line
edit to `NODE_TYPES`.

### What I'd do differently next time

- **Real React Flow** for the canvas — better UX (bend points, mini-map,
  keyboard shortcuts, multi-select). The custom SVG is fine for an MVP
  but doesn't scale to complex graphs.
- **GitHub Actions API push** — once the YAML is generated, commit it to
  the user's repo and trigger a workflow run via the Actions REST API.
  Requires OAuth + a GitHub App, but it's the obvious next step.
- **Multi-platform CI** — let the user pick `runs-on: [ubuntu-latest,
  macos-latest, windows-latest]` as another matrix axis.
- **Cost optimization** — skip the LLM call when the cached graph
  description matches; share `yamlCache` across runs; let the user
  "freeze" a pipeline so it stops calling the LLM.
- **Multi-job pipelines** — the YAML compiler currently emits a single
  `build` job. Supporting multi-job (e.g. a `lint` job that runs in
  parallel with `test`) is a natural follow-on.

### Resume bullet

> Built an AI-powered CI/CD pipeline builder (Next.js 16, TS, Prisma +
> SQLite) that turns natural-language descriptions into GitHub Actions
> YAML via a custom SVG drag-and-drop canvas (no React Flow), with
> automatic smart caching, matrix expansion, deterministic mock
> simulation, and 45+ unit tests across 7 pure-function modules.

---

## License

MIT — see [LICENSE](./LICENSE).

---

## Push to GitHub

```bash
gh repo create cicd-pipeline-builder --public --source=. --remote=origin --push
```
