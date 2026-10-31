const {Router} = require('express')
const userAuthRoutes = require('./userAuth.route')
const connectionRoutes = require('./connection.route')
const userAgreementsRoutes = require('./userAgreements.route')
const userSpaceRoutes = require('./userSpace.route')
const userSecurityRoutes = require("./security.route");
const userKycRoutes = require("./kyc.route");
const userProfileRoutes = require("./profile.route");
const collaboratorRoutes = require("./collaborator.route");
const router = Router()


router.use('/', userAuthRoutes)
router.use('/connections', connectionRoutes)
router.use('/agreements', userAgreementsRoutes)
router.use('/space', userSpaceRoutes)
router.use("/profile", userProfileRoutes);
router.use("/security", userSecurityRoutes);
router.use("/kyc", userKycRoutes);
router.use("/collaborators", collaboratorRoutes);


module.exports = router;