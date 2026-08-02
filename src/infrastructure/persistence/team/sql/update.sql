UPDATE teams
SET
  name = $(name)
WHERE
  id = $(id)
RETURNING
  id,
  name;