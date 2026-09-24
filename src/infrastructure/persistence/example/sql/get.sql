SELECT
  id,
  name,
  example_kind_id,
  url,
  concurrency_token (version) AS concurrency_token
FROM
  examples
WHERE
  id = $(id);