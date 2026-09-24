const { signJwt } = require("./jwt");

const generateUserToken = (payload) => signJwt(payload, "user");
const generateAdminToken = (payload) => signJwt(payload, "admin");

module.exports = { generateUserToken, generateAdminToken };
