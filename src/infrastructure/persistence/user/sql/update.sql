UPDATE users
SET
  first_name = $(first_name),
  last_name = $(last_name),
  email = $(email)
WHERE
  id = $(id)
RETURNING
  id,
  first_name,
  last_name,
  email,
  team_id;