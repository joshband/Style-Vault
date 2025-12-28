# Code Analysis Report

**Generated:** 2025-12-28T01:12:53.768Z

## Code Metrics

| Metric | Value |
|--------|-------|
| Total Files | 233 |
| Total Lines | 55,477 |
| Dependencies | 91 |
| Dev Dependencies | 22 |
| node_modules Size | 568M |

### Files by Type

| Type | Count | Lines |
|------|-------|-------|
| .js | 5 | 836 |
| .tsx | 102 | 23,331 |
| .ts | 126 | 31,310 |

### Largest Files

| File | Lines |
|------|-------|
| server/routes.ts | 3496 |
| client/src/pages/Inspect.tsx | 1784 |
| client/src/pages/Author.tsx | 1491 |
| server/storage.ts | 1411 |
| server/admin-routes.ts | 1123 |
| client/src/components/deploy-dialog.tsx | 922 |
| server/style-regeneration.ts | 850 |
| server/comprehensive-dtcg.ts | 804 |
| server/prodia-generation.ts | 795 |
| client/src/pages/Admin.tsx | 761 |

---

## Code Quality Score: 82/100

### Strengths

- ✅ TypeScript used for 102 React components
- ✅ TypeScript used for 126 modules
- ✅ Good separation of client, server, and shared code
- ✅ 21 test files found

### Issues to Address

- ⚠️ 22 files exceed 500 lines - consider splitting
- ⚠️ 193 usages of 'any' type - consider stricter typing
- ⚠️ 113 console.log statements found - consider removing for production

---

## Potentially Unused Exports

No obviously unused exports detected.

---

## Recommendations

1. **Bundle Optimization**: Consider code splitting for large components
2. **Type Safety**: Reduce usage of 'any' types where possible
3. **Performance**: Implement lazy loading for less-used pages
4. **Maintenance**: Split files larger than 500 lines
5. **Testing**: Expand test coverage to include more components
