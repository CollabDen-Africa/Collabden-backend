const jwt = require("jsonwebtoken");

const JWT_ALGORITHM = "HS256";
const MAX_CLOCK_TOLERANCE_SECONDS = 60;

const getClockToleranceSeconds = () => {
  const rawValue = process.env.JWT_CLOCK_TOLERANCE_SECONDS || "30";
  if (!/^\d+$/.test(rawValue)) {
    throw new Error(`JWT_CLOCK_TOLERANCE_SECONDS must be an integer between 0 and ${MAX_CLOCK_TOLERANCE_SECONDS}`);
  }
  const configured = Number(rawValue);
  if (!Number.isFinite(configured) || configured < 0 || configured > MAX_CLOCK_TOLERANCE_SECONDS) {
    throw new Error(`JWT_CLOCK_TOLERANCE_SECONDS must be between 0 and ${MAX_CLOCK_TOLERANCE_SECONDS}`);
  }
  return configured;
};

const getJwtConfig = () => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET must be configured");
  return {
    secret: process.env.JWT_SECRET,
    algorithm: JWT_ALGORITHM,
    issuer: process.env.JWT_ISSUER || "collabden-api",
    audience: process.env.JWT_AUDIENCE || "collabden-web",
    clockTolerance: getClockToleranceSeconds(),
  };
};

const signJwt = (payload, tokenType) => {
  const config = getJwtConfig();
  // NumericDate values are Unix seconds (UTC); jsonwebtoken derives iat from Date.now().
  return jwt.sign({ ...payload, tokenType }, config.secret, {
    algorithm: config.algorithm,
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    notBefore: 0,
    issuer: config.issuer,
    audience: config.audience,
  });
};

const verifyJwt = (token, expectedTokenType, config = getJwtConfig()) => {
  const decoded = jwt.verify(token, config.secret, {
    algorithms: [config.algorithm], issuer: config.issuer, audience: config.audience,
    clockTolerance: config.clockTolerance,
  });
  // jsonwebtoken validates exp and nbf, but does not reject a future iat.
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(decoded.iat) || decoded.iat > now + config.clockTolerance) {
    throw new jwt.JsonWebTokenError("Token issued in the future");
  }
  if (expectedTokenType && decoded.tokenType !== expectedTokenType) throw new jwt.JsonWebTokenError("Invalid token type");
  return decoded;
};

module.exports = { JWT_ALGORITHM, getJwtConfig, signJwt, verifyJwt };
