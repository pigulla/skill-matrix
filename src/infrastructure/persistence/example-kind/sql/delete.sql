DELETE FROM example_kinds
WHERE
  kind = $(kind)
RETURNING
  kind;