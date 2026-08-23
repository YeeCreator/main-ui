# support advice (updates-outbox): main-ui -> scene-studio

## Context

`main-ui` supports `scene-studio` because `scene-studio` depends on `main-ui`.

## Adaptation Advice

`main-ui` has prepared local versioned package `main-ui-0.0.2.tgz`. This is a compatible release; no mandatory renderer rewrite is expected.

## Suggested Steps

- Required change: Replace the local `file:../main-ui` dependency with the delivered `main-ui-0.0.2.tgz` when ready, then run `pnpm install`.
- Compatibility note: Existing workspace/editor/renderer registrations should remain valid. Keep `file:../main-ui` only for active source-level co-development.
- Validation command: `pnpm install && pnpm build` (or the host project's normal validation command).
- Deadline or release note: Upgrade is opt-in; report any issue through the relay mailbox before adopting the next release.
