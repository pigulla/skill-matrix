INSERT INTO
  example_kinds (id, name, last_updated)
VALUES
  ($(id), $(name), $(lastUpdated))
RETURNING
  id,
  name,
  concurrency_token (version) AS concurrency_token;