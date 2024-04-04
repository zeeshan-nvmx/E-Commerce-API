const express = require('express')
const router = express.Router()
const { register, login, forgotPassword, verifyOTP, resetPassword, showMe } = require('../controllers/authController')

router.route('/register').post(register)
router.route('/login').post(login)
router.route('/forgot-password').post(forgotPassword)
router.route('/verify-otp').post(verifyOTP)
router.route('/reset-password').post(resetPassword)
router.route('/showme').post(showMe)

module.exports = router
