# V1 maintenance migration note

This maintenance release keeps `POST /` updates compatible by default. Set `settings.legacyPostUpdate: false` and migrate callers to `PATCH /:id` to adopt explicit CRUD semantics.

Errors now have `data: null` and a machine-readable `code`; validation text moved from `error` to structured `details`. Search values are literal by default, sorting must be allow-listed, and list limits default to 100. Configure `search.allowRegex`, `get.sort`, and `get.maxLimit` deliberately when upgrading.

If a consumer relies on a custom list response name, use `settings.responseKey`; default pluralization now handles irregular English model names.
