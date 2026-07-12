const {Router} = require('express')
const userAuthRoutes = require('./userAuth.route')
const connectionRoutes = require('./connection.route')
const userAgreementsRoutes = require('./userAgreements.route')
const userSecurityRoutes = require("./security.route");
const userPersonaRoutes = require("./persona.route");
const userProfileRoutes = require("./profile.route");
const router = Router()


router.use('/', userAuthRoutes)
router.use('/connections', connectionRoutes)
router.use('/agreements', userAgreementsRoutes)
router.use("/profile", userProfileRoutes);
router.use("/security", userSecurityRoutes);
router.use("/persona", userPersonaRoutes);


module.exports = router;