const jwt = require('jsonwebtoken')
const winston = require('winston') // Ensure winston is correctly imported

const auth = (req, res, next) => {
  // Safely attempt to access the 'Authorization' header
  const authHeader = req.header('Authorization')
  if (!authHeader) {
    winston.error('No Authorization header provided')
    return res.status(401).json({ message: 'No Authorization header provided' })
  }

  // Attempt to extract the token from the header
  let token
  try {
    token = authHeader.replace('Bearer ', '')
  } catch (error) {
    winston.error('Error processing the Authorization header:', error.message)
    return res.status(401).json({ message: 'Error processing the Authorization header' })
  }

  // Verify the token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const { _id, name, email, role, addresses } = decoded

    req.user = { id: _id, name, email, role, addresses }

    next()
  } catch (err) {
    winston.error('Authentication error:', err.message)
    res.status(401).json({ message: 'Invalid token' })
  }
}

module.exports = auth
