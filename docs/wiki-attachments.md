# Wiki attachments (Azure DevOps REST)

Notes for **maintainers** who work on wiki file upload: toolbar insert image, drag-and-drop, and paste. Implementation lives in [`src/services/attachment-service.ts`](../src/services/attachment-service.ts).

Behavior described here was verified against the live `dev.azure.com` wiki API; treat Microsoft Learn as the source of truth for parameter names and supported `api-version` values.

## Official reference

- [Attachments – Create (Wiki)](https://learn.microsoft.com/en-us/rest/api/azure/devops/wiki/attachments/create)

## Endpoint shape

Upload uses **Attachments – Create (Wiki)**:

```http
PUT {origin}/{organization}/{project}/_apis/wiki/wikis/{wikiIdentifier}/attachments?name={fileName}&api-version=7.1
```

The generated file name must be passed as the **`name` query parameter**. A path-style URL such as `.../attachments/{fileName}` is **not** what the service expects and leads to failed uploads.

## Wiki version / branch

Wiki page URLs may include `wikiVersion` (for example UI tokens like `GBwikiMaster`). The extension normalizes these for Git-backed APIs in `normalizeWikiVersionForGitApi` in [`src/ado-wiki-api.ts`](../src/ado-wiki-api.ts).

When uploading, the client may add:

- `versionDescriptor.versionType=branch`
- `versionDescriptor.version={branchName}`

so the attachment lands on the same branch as the page being edited.

## Request body: Base64 as `application/octet-stream`

Microsoft’s REST pages often describe the body as **`application/octet-stream`** (raw file bytes). In practice, the service **decodes the request body as a Base64 string**. Sending **raw file bytes** can produce **HTTP 500** with *“The input is not a valid Base-64 string…”*.

The implementation Base64-encodes the file, then sends those **ASCII characters as UTF-8 bytes** with `Content-Type: application/octet-stream`.

Using **`text/plain`** for the body is **rejected (HTTP 400)**: this `PUT` only allows `application/json`, `application/json-patch+json`, and `application/octet-stream`.

## Errors and browser context

- Failed uploads surface **HTTP status** and, when available, **response body** text (including JSON `message`) to simplify debugging.
- The content script uses `fetch` with **`credentials: 'include'`** on the wiki origin. Host access is declared in [`public/manifest.json`](../public/manifest.json) (`dev.azure.com` and `*.visualstudio.com`).
