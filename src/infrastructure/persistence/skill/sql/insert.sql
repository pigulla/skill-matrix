INSERT INTO
  skills (id, name, description, last_updated)
VALUES
  ($(id), $(name), $(description), $(lastUpdated))
RETURNING
  id,
  name,
  description,
  concurrency_token (version) AS concurrency_token;