DELETE FROM example_kinds
WHERE
  id = $(id)
RETURNING
  id,
  name;