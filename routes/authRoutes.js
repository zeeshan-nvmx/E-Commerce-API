const express = require('express')
const router = express.Router()
const { register, login, forgotPassword, resetPassword, showMe } = require('../controllers/authController')

router.route('/register').post(register)
router.route('/login').post(login)
router.route('/forgot-password').post(forgotPassword)
router.route('/reset-password/:resetToken').put(resetPassword)
router.route('/showme').post(showMe)

module.exports = router
