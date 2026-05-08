const {Router} = require('express')
const userAuthRoutes = require('./userAuth.route')
const connectionRoutes = require('./connection.route')
const router = Router()


router.use('/', userAuthRoutes)
router.use('/connections', connectionRoutes)

module.exports = router;