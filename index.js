const express = require('express')
const dotenv = require('dotenv')
const connectDB = require('./utils/db')
const errorHandler = require('./utils/errorMiddlewear')
const helmet = require('helmet')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
const morgan = require('morgan')

dotenv.config()
const app = express()

// var corsOptions = {
//     origin: true,
//     credentials: true,
//     allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With', 'X-Auth-Token'],
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
// };
// app.use(cors(corsOptions));
// app.options('*', cors(corsOptions)); // Enable pre-flight for all routes

// Configure morgan to log requests to the console
app.use(morgan('common'))

// Security middlewares
app.use(helmet())
app.use(cors())


// Trust the X-Forwarded-For header
// app.set('trust proxy', 1)

// Rate limiting (to prevent brute-force attacks)
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // Limit each IP to 100 requests per windowMs
// })
// app.use(limiter)

app.use(express.json())

// Import routes
const authRoutes = require('./routes/authRoutes')
const categoryRoutes = require('./routes/categoryRoutes')
const productRoutes = require('./routes/productRoutes')
const orderRoutes = require('./routes/orderRoutes')
const heroRoutes = require('./routes/heroRoutes')

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/products', productRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api', heroRoutes)

// 404 handler
app.use((req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`)
  res.status(404)
  console.error(`${error.status || 500} - ${error.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`)
  next(error)
})

// Error handler middleware
app.use(errorHandler)

const PORT = process.env.PORT || 4000

// Connect to the database and start the server
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
    })
  })
  .catch((err) => {
    console.error('Failed to connect to the database:', err)
    process.exit(1)
  })
