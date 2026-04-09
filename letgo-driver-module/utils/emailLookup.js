/**
 * MongoDB filter: match document email to a already-normalized (lowercase, trimmed) string.
 * Old records may store mixed-case emails; exact { email: normalized } lookups miss them.
 */
function emailMatchExpr(normalizedLowerEmail) {
  return {
    $expr: {
      $eq: [
        {
          $toLower: {
            $trim: { input: { $ifNull: ["$email", ""] } },
          },
        },
        normalizedLowerEmail,
      ],
    },
  };
}

module.exports = { emailMatchExpr };
