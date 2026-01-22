# Refactor App.tsx

Current state: ~1000 lines in single App.tsx file.

## Target Structure

```
src/
  types/
    index.ts              # All interfaces (Prospect, Draft, AgentTask, StreamEvent, etc.)

  utils/
    mailto.ts             # mailto helper
    api.ts                # fetch wrappers for /api/action

  components/
    ActionButton.tsx      # Reusable action button with click feedback

    TaskPanel/
      index.tsx           # Main panel with modes (minimized/normal/expanded)
      ToolBadge.tsx       # Tool name badges (Bash, WebFetch, etc.)
      StreamEventView.tsx # Single event renderer (text/tool_call/tool_result)

    Drafts/
      DraftCard.tsx       # Expandable draft card in drafts tab
      DraftModal.tsx      # Full-screen draft modal for rewriting

    Prospects/
      ProspectListItem.tsx    # Left panel list item (avatar, name, draft badge)
      ProspectProfile.tsx     # Right panel full profile view
      EditableDraft.tsx       # Inline editable draft with save
      PipelineProgress.tsx    # Found → Enriched → Drafted → Contacted → Replied

  App.tsx                 # ~100 lines: layout, routing, state, tabs
```

## Migration Order

1. **types/index.ts** - Move all interfaces first (no dependencies)
   - StreamEvent, AgentTask, Stats, Prospect, Draft, Source, Data
   - OutreachFilter type + labels

2. **utils/** - Extract helper functions
   - `mailto.ts` - the mailto link builder
   - `api.ts` - optional: wrap fetch calls to /api/action

3. **Small standalone components**
   - ActionButton.tsx (used in multiple places)
   - ToolBadge.tsx (only used in TaskPanel)

4. **TaskPanel/** - Self-contained, no external deps
   - ToolBadge.tsx
   - StreamEventView.tsx
   - index.tsx (the main panel)

5. **Drafts/** - Used in drafts tab + modal
   - DraftCard.tsx
   - DraftModal.tsx

6. **Prospects/** - The main feature
   - PipelineProgress.tsx (small, no deps)
   - ProspectListItem.tsx
   - EditableDraft.tsx
   - ProspectProfile.tsx (imports EditableDraft, PipelineProgress)

7. **Clean up App.tsx**
   - Import all components
   - Keep: state, data fetching, tab switching, layout
   - Should be ~100-150 lines

## Rules

- Each component in its own file
- Use named exports
- Import types from `../types` or `../../types`
- No circular dependencies
- Keep related components in folders (TaskPanel/, Drafts/, Prospects/)
- Component folders use index.tsx for main export

## Current Line Counts (approx)

- Interfaces: ~70 lines
- mailto: ~3 lines
- DraftCard: ~50 lines
- ActionButton: ~30 lines
- DraftModal: ~85 lines
- ToolBadge: ~15 lines
- StreamEventView: ~50 lines
- TaskPanel: ~250 lines
- ProspectListItem: ~35 lines
- EditableDraft: ~110 lines
- PipelineProgress: ~40 lines
- ProspectProfile: ~130 lines
- App (main): ~180 lines
