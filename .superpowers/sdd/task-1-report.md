# Task 1 Report: vitest altyapısı + `searchStateByQuery`

## Summary

Successfully implemented Task 1 of the sentinel-mcp feature. Added complete vitest test infrastructure to `packages/sentinel` and implemented a query-based state search utility (`searchStateByQuery`) that scans React state objects for both path segment matches and normalized value matches.

## What was done

### 1. Test Infrastructure Setup
- Installed `vitest` (~0.34.0) and `jsdom` (^29.1.1) as devDependencies
- Created `packages/sentinel/vitest.config.ts` with node environment configuration
- Added `"test": "vitest run"` script to `packages/sentinel/package.json`

### 2. Test File Creation
- Created `packages/sentinel/src/utils/__tests__/stateQuery.test.ts` with 6 comprehensive test cases covering:
  - Value normalization and matching (leaf value search)
  - Path segment matching (hierarchy search)
  - Non-string leaf handling (booleans)
  - Sort ordering (value matches before path matches)
  - Edge cases (short queries, null state)
  - Result count limiting (MAX_MATCHES = 20)

### 3. Implementation
- Created `packages/sentinel/src/utils/stateQuery.ts` implementing:
  - `searchStateByQuery(state: unknown, query: string): StateQueryMatch[]` function
  - `StateQueryMatch` type with fields: `path`, `preview`, `matchType` ("path" | "value"), `norm` (optional)
  - Depth-first tree walk with visitor counting and depth limiting
  - Query normalization (lowercase) for case-insensitive matching
  - Two-phase matching: normalized value content + path segment analysis
  - Sort order: value matches (norm !== undefined and query match) prioritized before path matches
  - Safety limits: MAX_STATE_NODES=60000, MAX_STATE_DEPTH=10, MAX_MATCHES=20, MIN_QUERY_LENGTH=3

## Test Results

```
✓ src/utils/__tests__/stateQuery.test.ts (6 tests) 3ms

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Start at  15:12:22
   Duration  308ms (transform 61ms, setup 0ms, collect 0ms, tests 0m, environment 0ms, prepare 45ms)
```

All 6 tests pass:
1. ✓ matches leaf values by normalized content
2. ✓ matches paths whose segment contains the query
3. ✓ includes path-matched non-string leaves (booleans)
4. ✓ sorts value matches before path matches
5. ✓ returns empty for short queries and empty state
6. ✓ caps result count

## Test Execution

Command: `cd packages/sentinel && npx vitest run src/utils/__tests__/stateQuery.test.ts`

Initial run (before implementation): FAILED with "Cannot find module '../stateQuery'" (expected)
Final run (after implementation): PASSED (6/6 tests)

## Deviations from Brief

### Node version incompatibility
The brief's initial vitest/vite installation installed versions incompatible with the system Node v18.18.1 (vitest 4.1.10 requires Node 20+). Downgraded to:
- `vitest` ~0.34.0 (instead of latest)
- `vite` 7.3.6 (instead of 8.0.12)

The implementation and test interface remain **exactly as specified** — only dependency versions were adjusted for compatibility. The test suite and source code match the brief verbatim.

## Self-Review Notes

### Code correctness
- ✓ `searchStateByQuery` signature matches brief exactly
- ✓ `StateQueryMatch` type has all required fields (path, preview, matchType, norm)
- ✓ Imports (`normalize`, `getPreview`) from existing utilities
- ✓ All 6 test cases pass without modification
- ✓ Tree walk logic correctly handles arrays, objects, primitives
- ✓ Sort order correctly prioritizes value matches
- ✓ Safety limits (MAX_NODES, MAX_DEPTH, MAX_MATCHES) implemented

### Files created/modified
- ✓ vitest.config.ts: Created (node environment)
- ✓ stateQuery.ts: Created (full implementation)
- ✓ stateQuery.test.ts: Created (6 test cases)
- ✓ package.json: Modified (devDeps + test script)
- ✓ No existing source files modified (per requirements)

### Commit
- Hash: `24b79e0`
- Message: `feat: query-based state search for MCP lineage`
- Files committed: vitest.config.ts, stateQuery.ts, stateQuery.test.ts, package.json, package-lock.json
- Branch: experimental

## Dependencies for Next Tasks

This task provides the foundation for:
- **Task 2**: Will consume `searchStateByQuery()` for state search in MCP handler
- **Task 8**: Will use `StateQueryMatch` type for lineage payload structure

The exported interface (`searchStateByQuery`, `StateQueryMatch`) is stable and matches brief specification exactly.
