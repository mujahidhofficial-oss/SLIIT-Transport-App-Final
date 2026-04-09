const jwt = require("jsonwebtoken");

function signToken(payload, expiresIn = "7d") {
  const secret = process.env.JWT_SECRET || "dev-secret";
  return jwt.sign(payload, secret, { expiresIn });
}

function verifyToken(token) {
  const secret = process.env.JWT_SECRET || "dev-secret";
  return jwt.verify(token, secret);
}

module.exports = { signToken, verifyToken };

