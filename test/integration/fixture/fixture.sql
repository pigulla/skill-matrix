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
-- Skill example kinds
--
INSERT INTO
  example_kinds (kind)
VALUES
  ('technology'),
  ('pattern'),
  ('concept'),
  ('methodology');

--
-- Skills
--
INSERT INTO
  skills (id, name, description)
VALUES
  (
    '33333333-0003-4000-8000-111111111111',
    'Frontend Development',
    'Building and styling user-facing interfaces for the web.'
  ),
  (
    '33333333-0003-4000-8000-222222222222',
    'Backend Development',
    'Designing and building server-side services, APIs, and data persistence.'
  ),
  (
    '33333333-0003-4000-8000-333333333333',
    'Software Architecture',
    'The high-level structure of a software system, including its components, relationships, and the key decisions guiding its design and evolution.'
  ),
  (
    '33333333-0003-4000-8000-444444444444',
    'Quality Assurance',
    'Verifying software correctness and reliability through testing and process improvement.'
  );

--
-- Examples
--
INSERT INTO
  examples (id, name, kind, url)
VALUES
  (
    '44444444-0004-4000-8000-111111111111',
    'HTML',
    'technology',
    NULL
  ),
  (
    '44444444-0004-4000-8000-222222222222',
    'CSS',
    'technology',
    NULL
  ),
  (
    '44444444-0004-4000-8000-333333333333',
    'React',
    'technology',
    'https://react.dev'
  ),
  (
    '44444444-0004-4000-8000-444444444444',
    'Nest.js',
    'technology',
    'https://nestjs.com'
  ),
  (
    '44444444-0004-4000-8000-555555555555',
    'Vue.js',
    'technology',
    'https://vuejs.org'
  ),
  (
    '44444444-0004-4000-8000-666666666666',
    'PostgreSQL',
    'technology',
    'https://www.postgresql.org'
  ),
  (
    '44444444-0004-4000-8000-777777777777',
    'SOLID',
    'pattern',
    NULL
  ),
  (
    '44444444-0004-4000-8000-888888888888',
    'Hexagonal Architecture',
    'pattern',
    'https://en.wikipedia.org/wiki/Hexagonal_architecture_(software)'
  ),
  (
    '44444444-0004-4000-8000-999999999999',
    'COBOL',
    'technology',
    NULL
  ),
  (
    '44444444-0004-4000-8000-aaaaaaaaaaaa',
    'Infrastructure-as-Code',
    'methodology',
    NULL
  ),
  (
    '44444444-0004-4000-8000-bbbbbbbbbbbb',
    'Domain-Driven Design',
    'methodology',
    'https://en.wikipedia.org/wiki/Domain-driven_design'
  ),
  (
    '44444444-0004-4000-8000-cccccccccccc',
    'Circuit Breaker',
    'pattern',
    NULL
  ),
  (
    '44444444-0004-4000-8000-dddddddddddd',
    'Bulkhead',
    'pattern',
    NULL
  ),
  (
    '44444444-0004-4000-8000-eeeeeeeeeeee',
    'SQL',
    'technology',
    NULL
  ),
  (
    '44444444-0004-4000-8000-ffffffffffff',
    'Factory',
    'pattern',
    NULL
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