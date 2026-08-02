UPDATE users
SET
  team_id = $(team_id)
WHERE
  id = $(id)
RETURNING
  id,
  first_name,
  last_name,
  email,
  team_id;