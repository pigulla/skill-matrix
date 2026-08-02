INSERT INTO
  teams (id, name)
VALUES
  ($(id), $(name))
RETURNING
  id,
  name;