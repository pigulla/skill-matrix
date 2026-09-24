WITH
  current_row AS (
    SELECT
      1
    FROM
      example_kinds
    WHERE
      id = $(id)
  ),
  deleted_row AS (
    DELETE FROM example_kinds
    WHERE
      id = $(id)
      AND concurrency_token (version) = $(expectedToken)
    RETURNING
      id
  )
SELECT
  deleted_row.id
FROM
  current_row
  LEFT JOIN deleted_row ON TRUE;