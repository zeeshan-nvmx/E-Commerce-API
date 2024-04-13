const express = require('express')
const router = express.Router()
const auth = require('../middleware/auth')
const {
  register,
  login,
  forgotPassword,
  verifyOTP,
  resetPassword,
  showMe,
  updateProfile,
  addAddress,
  deleteAddress,
  getUser
} = require('../controllers/authController')

router.route('/register').post(register)
router.route('/login').post(login)
router.route('/forgot-password').post(forgotPassword)
router.route('/verify-otp').post(verifyOTP)
router.route('/reset-password').post(resetPassword)
router.route('/showme').get(showMe)
router.route('/getuser').get(auth, getUser);

// Route for updating user profile
router.route('/updateprofile').put(auth, updateProfile);

// Route for adding a new address
router.route('/addresses').post(auth, addAddress);

// Route for deleting an address
router.route('/addresses/:id').delete(auth, deleteAddress);

module.exports = router
