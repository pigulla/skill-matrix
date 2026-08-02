SELECT
  id,
  first_name,
  last_name,
  email,
  team_id
FROM
  users
WHERE
  id = $(id);