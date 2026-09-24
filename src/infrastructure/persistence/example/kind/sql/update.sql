WITH
  current_row AS (
    SELECT
      1
    FROM
      example_kinds
    WHERE
      id = $(id)
  ),
  updated_row AS (
    UPDATE example_kinds
    SET
      name = $(name),
      last_updated = $(lastUpdated),
      version = version + 1
    WHERE
      id = $(id)
      AND concurrency_token (version) = $(expectedToken)
    RETURNING
      id,
      name,
      concurrency_token (version) AS concurrency_token
  )
SELECT
  updated_row.id,
  updated_row.name,
  updated_row.concurrency_token
FROM
  current_row
  LEFT JOIN updated_row ON TRUE;