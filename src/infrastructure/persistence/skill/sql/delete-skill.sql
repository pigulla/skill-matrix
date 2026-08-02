DELETE FROM skills
WHERE
  id = $(id)
RETURNING
  id;