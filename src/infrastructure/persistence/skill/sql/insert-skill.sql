INSERT INTO
  skills (id, name, description)
VALUES
  ($(id), $(name), $(description))
RETURNING
  id,
  name,
  description;