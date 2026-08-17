INSERT INTO
  skills (id, name, description, last_updated)
VALUES
  ($(id), $(name), $(description), $(lastUpdated))
RETURNING
  id,
  name,
  description,
  last_updated;