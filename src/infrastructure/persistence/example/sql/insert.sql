INSERT INTO
  examples (id, name, example_kind_id, url, last_updated)
VALUES
  (
    $(id),
    $(name),
    $(exampleKindId),
    $(url),
    $(lastUpdated)
  )
RETURNING
  id,
  name,
  example_kind_id,
  url,
  last_updated;