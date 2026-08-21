SELECT
  id,
  name,
  concurrency_token (version) AS concurrency_token
FROM
  example_kinds
ORDER BY
  id;