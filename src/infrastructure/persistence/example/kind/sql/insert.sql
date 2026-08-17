INSERT INTO
  example_kinds (id, name, last_updated)
VALUES
  ($(id), $(name), $(lastUpdated))
RETURNING
  id,
  name,
  last_updated;