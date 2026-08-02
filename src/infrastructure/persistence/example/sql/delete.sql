DELETE FROM examples
WHERE
  id = $(id)
RETURNING
  id;