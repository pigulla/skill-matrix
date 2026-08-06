INSERT INTO
  examples (id, name, example_kind_id, url)
VALUES
  ($(id), $(name), $(exampleKindId), $(url))
RETURNING
  id,
  name,
  example_kind_id,
  url;