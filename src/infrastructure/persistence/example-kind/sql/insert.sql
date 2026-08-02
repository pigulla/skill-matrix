INSERT INTO
  example_kinds (kind)
VALUES
  ($(kind))
RETURNING
  kind;