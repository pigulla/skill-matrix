--
-- Teams
--
INSERT INTO
  teams (id, name)
VALUES
  (
    '22222222-0002-4000-8000-111111111111',
    'Platform Engineering'
  ),
  ('22222222-0002-4000-8000-222222222222', 'Testing'),
  ('22222222-0002-4000-8000-333333333333', 'Traffic'),
  (
    '22222222-0002-4000-8000-444444444444',
    'Core Services'
  );

--
-- Users
--
INSERT INTO
  users (id, first_name, last_name, email, team_id)
VALUES
  (
    '11111111-0001-4000-8000-111111111111',
    'Peter',
    'Parker',
    'peter.parker@example.com',
    '22222222-0002-4000-8000-111111111111'
  ),
  (
    '11111111-0001-4000-8000-222222222222',
    'Priscilla',
    'Potts',
    'priscilla.potts@example.com',
    '22222222-0002-4000-8000-111111111111'
  ),
  (
    '11111111-0001-4000-8000-333333333333',
    'Theodore',
    'Trentin',
    'theodore.trentin@example.com',
    '22222222-0002-4000-8000-333333333333'
  ),
  (
    '11111111-0001-4000-8000-444444444444',
    'Tess',
    'Turner',
    'tess.turner@example.com',
    '22222222-0002-4000-8000-333333333333'
  ),
  (
    '11111111-0001-4000-8000-555555555555',
    'Clemens',
    'Cook',
    'clemens.cook@example.com',
    '22222222-0002-4000-8000-444444444444'
  ),
  (
    '11111111-0001-4000-8000-666666666666',
    'Cherie',
    'Cooper',
    'cherie.cooper@example.com',
    '22222222-0002-4000-8000-444444444444'
  ),
  (
    '11111111-0001-4000-8000-777777777777',
    'Courtney',
    'Cox',
    'courtney.cox@example.com',
    '22222222-0002-4000-8000-444444444444'
  );

--
-- Example kinds
--
INSERT INTO
  example_kinds (id, name)
VALUES
  ('55555555-0005-4000-8000-111111111111', 'concept'),
  (
    '55555555-0005-4000-8000-222222222222',
    'methodology'
  ),
  ('55555555-0005-4000-8000-333333333333', 'pattern'),
  (
    '55555555-0005-4000-8000-444444444444',
    'technology'
  );

--
-- Skills
--
INSERT INTO
  skills (id, name, description, last_updated)
VALUES
  (
    '33333333-0003-4000-8000-111111111111',
    'Frontend Development',
    'Building and styling user-facing interfaces for the web.',
    '2026-01-01T01:01:01.000Z'
  ),
  (
    '33333333-0003-4000-8000-222222222222',
    'Backend Development',
    'Designing and building server-side services, APIs, and data persistence.',
    '2026-01-01T02:02:02.000Z'
  ),
  (
    '33333333-0003-4000-8000-333333333333',
    'Software Architecture',
    'The high-level structure of a software system, including its components, relationships, and the key decisions guiding its design and evolution.',
    '2026-01-01T03:03:03.000Z'
  ),
  (
    '33333333-0003-4000-8000-444444444444',
    'Quality Assurance',
    'Verifying software correctness and reliability through testing and process improvement.',
    '2026-01-01T04:04:04.000Z'
  );

--
-- Examples
--
INSERT INTO
  examples (id, name, example_kind_id, url, last_updated)
VALUES
  (
    '44444444-0004-4000-8000-111111111111',
    'HTML',
    '55555555-0005-4000-8000-444444444444',
    NULL,
    '2026-01-01T01:01:01.000Z'
  ),
  (
    '44444444-0004-4000-8000-222222222222',
    'CSS',
    '55555555-0005-4000-8000-444444444444',
    NULL,
    '2026-01-01T02:02:02.000Z'
  ),
  (
    '44444444-0004-4000-8000-333333333333',
    'React',
    '55555555-0005-4000-8000-444444444444',
    'https://react.dev',
    '2026-01-01T03:03:03.000Z'
  ),
  (
    '44444444-0004-4000-8000-444444444444',
    'Nest.js',
    '55555555-0005-4000-8000-444444444444',
    'https://nestjs.com',
    '2026-01-01T04:04:04.000Z'
  ),
  (
    '44444444-0004-4000-8000-555555555555',
    'Vue.js',
    '55555555-0005-4000-8000-444444444444',
    'https://vuejs.org',
    '2026-01-01T05:05:05.000Z'
  ),
  (
    '44444444-0004-4000-8000-666666666666',
    'PostgreSQL',
    '55555555-0005-4000-8000-444444444444',
    'https://www.postgresql.org',
    '2026-01-01T06:06:06.000Z'
  ),
  (
    '44444444-0004-4000-8000-777777777777',
    'SOLID',
    '55555555-0005-4000-8000-333333333333',
    NULL,
    '2026-01-01T07:07:07.000Z'
  ),
  (
    '44444444-0004-4000-8000-888888888888',
    'Hexagonal Architecture',
    '55555555-0005-4000-8000-333333333333',
    'https://en.wikipedia.org/wiki/Hexagonal_architecture_(software)',
    '2026-01-01T08:08:08.000Z'
  ),
  (
    '44444444-0004-4000-8000-999999999999',
    'COBOL',
    '55555555-0005-4000-8000-444444444444',
    NULL,
    '2026-01-01T09:09:09.000Z'
  ),
  (
    '44444444-0004-4000-8000-aaaaaaaaaaaa',
    'Infrastructure-as-Code',
    '55555555-0005-4000-8000-222222222222',
    NULL,
    '2026-01-01T10:10:10.000Z'
  ),
  (
    '44444444-0004-4000-8000-bbbbbbbbbbbb',
    'Domain-Driven Design',
    '55555555-0005-4000-8000-222222222222',
    'https://en.wikipedia.org/wiki/Domain-driven_design',
    '2026-01-01T11:11:11.000Z'
  ),
  (
    '44444444-0004-4000-8000-cccccccccccc',
    'Circuit Breaker',
    '55555555-0005-4000-8000-333333333333',
    NULL,
    '2026-01-01T12:12:12.000Z'
  ),
  (
    '44444444-0004-4000-8000-dddddddddddd',
    'Bulkhead',
    '55555555-0005-4000-8000-333333333333',
    NULL,
    '2026-01-01T13:13:13.000Z'
  ),
  (
    '44444444-0004-4000-8000-eeeeeeeeeeee',
    'SQL',
    '55555555-0005-4000-8000-444444444444',
    NULL,
    '2026-01-01T14:14:14.000Z'
  ),
  (
    '44444444-0004-4000-8000-ffffffffffff',
    'Factory',
    '55555555-0005-4000-8000-333333333333',
    NULL,
    '2026-01-01T15:15:15.000Z'
  );

--
-- Examples <--> Skills
--
INSERT INTO
  examples_to_skills (skill_id, example_id)
VALUES
  (
    '33333333-0003-4000-8000-111111111111', -- Frontend Development
    '44444444-0004-4000-8000-333333333333' -- React
  ),
  (
    '33333333-0003-4000-8000-111111111111', -- Frontend Development
    '44444444-0004-4000-8000-555555555555' -- Vue.js
  ),
  (
    '33333333-0003-4000-8000-111111111111', -- Frontend Development
    '44444444-0004-4000-8000-111111111111' -- HTML
  ),
  (
    '33333333-0003-4000-8000-111111111111', -- Frontend Development
    '44444444-0004-4000-8000-222222222222' -- CSS
  ),
  (
    '33333333-0003-4000-8000-111111111111', -- Frontend Development
    '44444444-0004-4000-8000-ffffffffffff' -- Factory
  ),
  (
    '33333333-0003-4000-8000-222222222222', -- Backend Development
    '44444444-0004-4000-8000-444444444444' -- Nest.js
  ),
  (
    '33333333-0003-4000-8000-222222222222', -- Backend Development
    '44444444-0004-4000-8000-666666666666' -- PostgreSQL
  ),
  (
    '33333333-0003-4000-8000-222222222222', -- Backend Development
    '44444444-0004-4000-8000-cccccccccccc' -- Circuit Breaker
  ),
  (
    '33333333-0003-4000-8000-222222222222', -- Backend Development
    '44444444-0004-4000-8000-dddddddddddd' -- Bulkhead
  ),
  (
    '33333333-0003-4000-8000-222222222222', -- Backend Development
    '44444444-0004-4000-8000-eeeeeeeeeeee' -- SQL
  ),
  (
    '33333333-0003-4000-8000-222222222222', -- Backend Development
    '44444444-0004-4000-8000-ffffffffffff' -- Factory
  ),
  (
    '33333333-0003-4000-8000-222222222222', -- Backend Development
    '44444444-0004-4000-8000-aaaaaaaaaaaa' -- Infrastructure-as-Code
  ),
  (
    '33333333-0003-4000-8000-333333333333', -- Software Architecture
    '44444444-0004-4000-8000-888888888888' -- Hexagonal Architecture
  ),
  (
    '33333333-0003-4000-8000-333333333333', -- Software Architecture
    '44444444-0004-4000-8000-777777777777' -- SOLID
  ),
  (
    '33333333-0003-4000-8000-333333333333', -- Software Architecture
    '44444444-0004-4000-8000-bbbbbbbbbbbb' -- Domain-Driven Design
  );

--
-- Teams <--> Skills
--
INSERT INTO
  skills_to_teams (team_id, skill_id, proficiency)
VALUES
  (
    '22222222-0002-4000-8000-111111111111', -- Platform Engineering
    '33333333-0003-4000-8000-222222222222', -- Backend Development
    1
  ),
  (
    '22222222-0002-4000-8000-333333333333', -- Traffic
    '33333333-0003-4000-8000-222222222222', -- Backend Development
    2
  ),
  (
    '22222222-0002-4000-8000-333333333333', -- Traffic
    '33333333-0003-4000-8000-111111111111', -- Frontend Development
    3
  ),
  (
    '22222222-0002-4000-8000-333333333333', -- Traffic
    '33333333-0003-4000-8000-333333333333', -- Software Architecture
    2
  ),
  (
    '22222222-0002-4000-8000-444444444444', -- Core Services
    '33333333-0003-4000-8000-222222222222', -- Backend Development
    3
  ),
  (
    '22222222-0002-4000-8000-444444444444', -- Core Services
    '33333333-0003-4000-8000-333333333333', -- Software Architecture
    3
  );