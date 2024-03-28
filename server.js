const express = require('express')
const dotenv = require('dotenv')
const connectDB = require('./utils/db')
const errorHandler = require('./utils/errorMiddlewear')
const helmet = require('helmet')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
const morgan = require('morgan')
const winston = require('winston')
const cron = require('node-cron')
const fs = require('fs')

dotenv.config()
connectDB()

const app = express()

// Configure winston logger to log both to console and files
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
})

// Modify morgan setup to use winston for logging HTTP requests
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }))

// Security middlewares
app.use(helmet())
app.use(cors())

// Rate limiting (to prevent brute-force attacks)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
})
app.use(limiter)

// Body parser
app.use(express.json())

// Import routes
const authRoutes = require('./routes/authRoutes')
const categoryRoutes = require('./routes/categoryRoutes')
const productRoutes = require('./routes/productRoutes')
const orderRoutes = require('./routes/orderRoutes')
// const adminRoutes = require('./routes/adminRoutes');

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/products', productRoutes)
app.use('/api/orders', orderRoutes)
// app.use('/api/admin', adminRoutes);

// 404 handler
app.use((req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`)
  res.status(404)
  logger.error(`${error.status || 500} - ${error.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`)
  next(error)
})

// Error handler middleware
app.use(errorHandler)

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)

  // Set up a cron job to delete log files every 7 days
  cron.schedule(
    '0 0 * * 0',
    () => {
      try {
        // Delete the contents of error.log and combined.log
        fs.writeFileSync('error.log', '')
        fs.writeFileSync('combined.log', '')
        logger.info('Log files cleared.')
      } catch (err) {
        logger.error(`Error clearing log files: ${err.message}`)
      }
    },
    {
      scheduled: true,
      timezone: 'Europe/London', // Set your desired timezone here
    }
  )
})
