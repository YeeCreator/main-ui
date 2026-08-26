# Release archive

## main-ui 0.0.2

Git commit `1d23c56` (`v0.0.2`) still contains the complete 0.0.2 documentation set. The original `main-ui-0.0.2.tgz` was created before package docs were included, so it contains README, `dist/` and CSS but no `docs/` directory.

To preserve the original runtime artifact, `main-ui-0.0.2.tgz` is left unchanged. A documentation-complete companion package was reconstructed from that exact tarball plus the docs recovered from commit `1d23c56`:

```bash
pnpm add ./main-ui-0.0.2-with-docs.tgz
```

The companion package keeps version `0.0.2` and the original compiled files. Its docs include `USER_MANUAL.md`, `API_MANUAL.md`, `DEVELOPER_GUIDE.md`, `DEVELOPMENT_LOG.md`, host integration/adapter guides, profile validation, and the upgrade checklist.

For normal new releases, docs are now included automatically through the package `files` configuration and are available at `node_modules/main-ui/docs/README.md`.
