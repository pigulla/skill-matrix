SELECT
  id,
  name,
  concurrency_token (version) AS concurrency_token
FROM
  teams
ORDER BY
  id;