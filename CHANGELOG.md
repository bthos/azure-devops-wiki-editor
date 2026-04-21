# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.0.1] - 2026-04-19

### Fixed

- **Wiki attachment upload (Azure DevOps REST)**  
  - Use **Attachments – Create (Wiki)** with the file name in the `name` **query** parameter and `api-version=7.1`, not a path segment such as `.../attachments/{fileName}`.  
  - Send the file as **Base64**, then transmit those ASCII characters as **UTF-8 bytes** with `Content-Type: application/octet-stream`. Raw file bytes caused HTTP 500 (*invalid Base-64 string*); `text/plain` caused HTTP 400 (*Content-Type not supported for PUT*).  
  - When the wiki page has a version, send `versionDescriptor.versionType=branch` and `versionDescriptor.version` (aligned with `normalizeWikiVersionForGitApi` in `src/ado-wiki-api.ts`) so uploads land on the correct branch.  
  - Failed uploads now include **HTTP status** and response body details when available.

### Added

- Maintainer documentation: [`docs/wiki-attachments.md`](docs/wiki-attachments.md) (endpoint shape, body encoding, manifest / credentials).  
- Unit tests for attachment upload URL construction and request shape (`tests/unit/attachment-service.spec.ts`).

### Changed

- **README**: long technical attachment notes replaced with a short **Developer documentation** link to `docs/wiki-attachments.md`.  
- **README**: `test` script description updated (Vitest).

[Unreleased]: https://github.com/bthos/azure-devops-wiki-editor/compare/v3.0.1...HEAD
[3.0.1]: https://github.com/bthos/azure-devops-wiki-editor/releases/tag/v3.0.1
