const {Router} = require('express')
const userAuthRoutes = require('./userAuth.route')
const connectionRoutes = require('./connection.route')
const userAgreementsRoutes = require('./userAgreements.route')
const router = Router()


router.use('/', userAuthRoutes)
router.use('/connections', connectionRoutes)
router.use('/agreements', userAgreementsRoutes)
router.use('/profile', require('./profile.route'))

module.exports = router;