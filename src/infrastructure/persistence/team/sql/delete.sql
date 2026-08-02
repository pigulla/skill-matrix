DELETE FROM teams
WHERE
  id = $(id)
RETURNING
  id,
  name;