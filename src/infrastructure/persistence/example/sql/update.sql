UPDATE examples
SET
  name = $(name),
  example_kind_id = $(exampleKindId),
  url = $(url),
  last_updated = $(lastUpdated)
WHERE
  id = $(id)
RETURNING
  id,
  name,
  example_kind_id,
  url,
  last_updated;