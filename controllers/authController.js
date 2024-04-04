const User = require('../models/User')
const generateToken = require('../utils/generateToken')
const sendEmail = require('../utils/sendEmail')
const crypto = require('crypto')
const jwt = require('jsonwebtoken')

const register = async (req, res) => {
  const { name, email, password, role, addresses } = req.body

  try {
    const userExists = await User.findOne({ email })

    if (userExists) {
      return res.status(400).json({ message: 'User already exists', error: 'User already exists' })
    }

    const user = await User.create({ name, email, password, role, addresses })

    if (user) {
      const userData = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        addresses: user.addresses,
      }
      const token = generateToken({ id: user._id, name: user.name, email: user.email, role: user.role })
      res.status(201).json({ message: 'User created successfully', data: { user: userData, token } })
    } else {
      res.status(400).json({ message: 'Invalid user data', error: 'Invalid user data' })
    }
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong at server level', error: error.message })
  }
}

const login = async (req, res) => {
  const { email, password } = req.body

  try {
    const user = await User.findOne({ email })

    if (user && (await user.matchPassword(password))) {
      const { _id, name, email, role, addresses } = user
      const tokenUser = { _id, name, email, role, addresses }
      const token = generateToken(tokenUser)
      res.json({ message: 'User authenticated', data: { tokenUser, token } })
    } else {
      res.status(401).json({ message: 'Invalid email or password', error: 'Invalid email or password' })
    }
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong at server level', error: error.message })
  }
}

const forgotPassword = async (req, res) => {
  const { email } = req.body

  try {
    const user = await User.findOne({ email })

    if (!user) {
      return res.status(404).json({ message: 'User not found', error: 'User not found' })
    }

    // Generate a 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString()

    // Save the OTP and expiration time in the user document
    user.otp = otp
    user.otpExpire = Date.now() + 10 * 60 * 1000 // 10 minutes

    await user.save({ validateBeforeSave: false })

    const message = `
      <h1>OTP for Password Reset</h1>
      <p>Your OTP is: <strong>${otp}</strong></p>
      <p>This OTP will expire in 10 minutes.</p>
    `

    try {
      await sendEmail({
        to: user.email,
        subject: 'Password Reset OTP',
        text: message,
      })

      res.status(201).json({ message: 'A OTP sent to your email, please check you email.' })
    } catch (error) {
      user.otp = undefined
      user.otpExpire = undefined

      await user.save({ validateBeforeSave: false })

      return res.status(500).json({ message: 'Email could not be sent', error: error.message })
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const verifyOTP = async (req, res) => {
  const { otp } = req.body

  try {
    const user = await User.findOne({
      otp,
      otpExpire: { $gt: Date.now() },
    })

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP', error: 'Invalid or expired OTP' })
    }

    res.status(200).json({ message: 'OTP verified successfully, now you can reset your password' })
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong at server level', error: error.message })
  }
}

const resetPassword = async (req, res) => {
  const { newPassword, otp } = req.body

  try {
    const user = await User.findOne({
      otp,
      otpExpire: { $gt: Date.now() },
    })

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP', error: 'Invalid or expired OTP' })
    }

    user.password = newPassword
    user.otp = undefined
    user.otpExpire = undefined

    await user.save()

    res.status(200).json({ message: 'Password updated successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong at server level', error: error.message })
  }
}

const showMe = async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Invalid token format' })
    }
    const token = authHeader.split(' ')[1]

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const { password, iat, exp, ...userData } = decoded

    res.json({ message: 'User data retrieved', data: userData })
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: 'Invalid token', error: error.message })
    }
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

module.exports = {
  register,
  login,
  forgotPassword,
  verifyOTP,
  resetPassword,
  showMe,
}
