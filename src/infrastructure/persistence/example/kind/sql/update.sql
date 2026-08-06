UPDATE example_kinds
SET
  name = $(name)
WHERE
  id = $(id)
RETURNING
  id,
  name;