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

    const resetToken = user.getResetPasswordToken()
    await user.save({ validateBeforeSave: false })

    const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`

    const message = `
      <h1>You have requested a password reset</h1>
      <p>Please go to this link to reset your password:</p>
      <a href=${resetUrl} clicktracking=off>${resetUrl}</a>
    `

    try {
      await sendEmail({
        to: user.email,
        subject: 'Password Reset Request',
        text: message,
      })

      res.json({ message: 'Email sent successfully' })
    } catch (error) {
      user.resetPasswordToken = undefined
      user.resetPasswordExpire = undefined

      await user.save({ validateBeforeSave: false })

      return res.status(500).json({ message: 'Email could not be sent', error: error.message })
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const resetPassword = async (req, res) => {
  const resetPasswordToken = crypto.createHash('sha256').update(req.params.resetToken).digest('hex')

  try {
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    })

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token', error: 'Invalid or expired token' })
    }

    user.password = req.body.password
    user.resetPasswordToken = undefined
    user.resetPasswordExpire = undefined

    await user.save()

    res.json({ message: 'Password updated successfully' })
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
  resetPassword,
  showMe,
}
