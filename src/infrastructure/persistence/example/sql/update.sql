WITH
  current_row AS (
    SELECT
      1
    FROM
      examples
    WHERE
      id = $(id)
  ),
  updated_row AS (
    UPDATE examples
    SET
      name = $(name),
      example_kind_id = $(exampleKindId),
      url = $(url),
      last_updated = $(lastUpdated),
      version = version + 1
    WHERE
      id = $(id)
      AND concurrency_token (version) = $(expectedToken)
    RETURNING
      id,
      name,
      example_kind_id,
      url,
      concurrency_token (version) AS concurrency_token
  )
SELECT
  updated_row.id,
  updated_row.name,
  updated_row.example_kind_id,
  updated_row.url,
  updated_row.concurrency_token
FROM
  current_row
  LEFT JOIN updated_row ON TRUE;