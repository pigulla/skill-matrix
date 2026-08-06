INSERT INTO
  example_kinds (id, name)
VALUES
  ($(id), $(name))
RETURNING
  id,
  name;