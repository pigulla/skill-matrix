INSERT INTO
  examples (id, name, kind, url)
VALUES
  ($(id), $(name), $(kind), $(url))
RETURNING
  id,
  name,
  kind,
  url;