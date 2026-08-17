DELETE FROM users
WHERE
  id = $(id)
RETURNING
  id,
  first_name,
  last_name,
  email,
  team_id;