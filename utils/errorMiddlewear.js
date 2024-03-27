const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode
  const message = err.message || 'Internal Server Error'

  // Log the error
  console.error(`${statusCode} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`)

  // Send the error response
  res.status(statusCode).json({
    message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  })
}

module.exports = errorHandler
