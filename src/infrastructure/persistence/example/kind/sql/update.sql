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
      last_updated = $(lastUpdated)
    WHERE
      id = $(id)
      AND concurrency_token (last_updated) = $(expectedToken)
    RETURNING
      id,
      name,
      last_updated
  )
SELECT
  updated_row.id,
  updated_row.name,
  updated_row.last_updated
FROM
  current_row
  LEFT JOIN updated_row ON TRUE;