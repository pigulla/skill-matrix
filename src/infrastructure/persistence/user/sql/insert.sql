INSERT INTO
  users (id, first_name, last_name, email, team_id)
VALUES
  (
    $(id),
    $(first_name),
    $(last_name),
    $(email),
    $(team_id)
  )
RETURNING
  id,
  first_name,
  last_name,
  email,
  team_id;