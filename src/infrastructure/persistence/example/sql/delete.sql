WITH
  current_row AS (
    SELECT
      1
    FROM
      examples
    WHERE
      id = $(id)
  ),
  deleted_row AS (
    DELETE FROM examples
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