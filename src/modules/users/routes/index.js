const {Router} = require('express')
const userAuthRoutes = require('./userAuth.route')
const router = Router()


router.use('/', userAuthRoutes)

module.exports = router;