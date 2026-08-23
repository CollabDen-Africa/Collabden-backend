/**
 * Build a safe SQL WHERE clause snippet for Prisma raw queries.
 * Intended for use with $queryRawUnsafe inside the support ticket reporting service.
 *
 * @param {object} where - Object with optional keys: category, status, createdAt (with gte/lte)
 * @returns {string} SQL WHERE clause fragment (without the leading "WHERE" keyword)
 */
const buildRawWhereClause = (where) => {
  const parts = [];

  if (where.category) {
    parts.push(`"category" = '${where.category}'`);
  }

  if (where.status) {
    parts.push(`"status" = '${where.status}'`);
  }

  if (where.createdAt) {
    if (where.createdAt.gte) {
      parts.push(`"createdAt" >= '${where.createdAt.gte.toISOString()}'`);
    }
    if (where.createdAt.lte) {
      parts.push(`"createdAt" <= '${where.createdAt.lte.toISOString()}'`);
    }
  }

  return parts.length ? parts.join(" AND ") : "TRUE";
};

module.exports = { buildRawWhereClause };
