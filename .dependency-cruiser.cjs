const INTERFACE_OR_ERROR = '\\.(interface|error)\\.ts$'

module.exports = {
  forbidden: [
    {
      name: 'application-must-not-import-infrastructure-presentation-or-module',
      severity: 'error',
      from: { path: '^src/application/' },
      to: { path: ['^src/infrastructure/', '^src/presentation/', '^src/module/'] },
    },
    {
      name: 'domain-must-not-import-application-presentation-infrastructure-or-module',
      severity: 'error',
      from: { path: '^src/domain/' },
      to: {
        path: ['^src/application/', '^src/presentation/', '^src/infrastructure/', '^src/module/'],
      },
    },
    {
      name: 'presentation-must-not-import-module-or-infrastructure',
      severity: 'error',
      from: { path: '^src/presentation/' },
      to: { path: ['^src/module/', '^src/infrastructure/'] },
    },
    {
      name: 'presentation-must-not-import-application-implementation',
      comment:
        'presentation may depend on application interfaces and errors, but not implementations',
      severity: 'error',
      from: { path: '^src/presentation/' },
      to: { path: '^src/application/', pathNot: INTERFACE_OR_ERROR },
    },
    {
      name: 'infrastructure-must-not-import-presentation-or-module',
      severity: 'error',
      from: { path: '^src/infrastructure/' },
      to: { path: ['^src/presentation/', '^src/module/'] },
    },
    {
      name: 'infrastructure-must-not-import-application-implementation',
      comment:
        'infrastructure may depend on application interfaces and errors, but not implementations',
      severity: 'error',
      from: { path: '^src/infrastructure/' },
      to: { path: '^src/application/', pathNot: INTERFACE_OR_ERROR },
    },
    {
      name: 'util-must-not-import-application-domain-presentation-infrastructure-or-module',
      comment:
        'Exceptions: src/infrastructure/persistence/error/ (a constant table plus pure DatabaseError predicates) and ' +
        'src/application/error/ (thrown-not-Err error classes) are both small, pure — no DI, no framework types, no ' +
        'side effects — so util may reach into either directly rather than duplicating their contents.',
      severity: 'error',
      from: { path: '^src/util/' },
      to: {
        path: [
          '^src/application/',
          '^src/domain/',
          '^src/presentation/',
          '^src/infrastructure/',
          '^src/module/',
        ],
        pathNot: ['^src/infrastructure/persistence/error/', '^src/application/error/'],
      },
    },
  ],
  options: {
    // This project resolves internal modules via the package.json "imports" field (the "#/*" alias), gated behind a
    // custom "development" condition (see tsconfig.json's customConditions). enhanced-resolve's default conditionNames
    // does not include it, and the imports map has no "default" fallback, so without this the resolver silently fails
    // to resolve any "#/..." import and dependency-cruiser reports zero violations regardless of what the rules say.
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['development', 'import', 'require', 'node', 'default', 'types'],
    },
  },
}
