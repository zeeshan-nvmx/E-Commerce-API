
// Enhance the errorHandler to log detailed error information
const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode
  const message = err.message || 'Internal Server Error'

  // Detailed error log
  const errorDetails = `${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip} - Stack: ${err.stack}`

  // Log the error to the console for development
  console.error(errorDetails)

  // Use winston to log the error to files
  winston.error(errorDetails)

  // Send the error response
  res.status(statusCode).json({
    message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  })
}

module.exports = errorHandler
