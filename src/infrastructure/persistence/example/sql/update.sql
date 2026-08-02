UPDATE examples
SET
  name = $(name),
  kind = $(kind),
  url = $(url)
WHERE
  id = $(id)
RETURNING
  id,
  name,
  kind,
  url;