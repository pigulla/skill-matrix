UPDATE examples
SET
  name = $(name),
  example_kind_id = $(exampleKindId),
  url = $(url)
WHERE
  id = $(id)
RETURNING
  id,
  name,
  example_kind_id,
  url;