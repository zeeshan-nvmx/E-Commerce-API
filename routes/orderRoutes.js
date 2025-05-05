const express = require('express')
const router = express.Router()
const auth = require('../middleware/auth')
const authorizeRoles = require('../middleware/roleAuthorization')
const { getOrders, getOrderById, getShippingRates, createOrder, stripe_webhook, updateOrderToDelivered, getShippingLabel, getOrderStats, getUserOrders, getUserSpendingSummary } = require('../controllers/orderController')

router.get('/', auth, getOrders)
router.get('/stats', auth, getOrderStats)
router.get('/:id', auth, getOrderById)
router.post('/shipping-rates', auth, getShippingRates)
router.post('/', auth, createOrder)
router.post('/stripe-webhook', stripe_webhook)
router.put('/:id/status', auth, updateOrderToDelivered)
router.get('/:id/shipping-label', auth, getShippingLabel)

// Admin-only routes
router.get('/user/:userId', auth, authorizeRoles('admin', 'superadmin'), getUserOrders)
router.get('/user/:userId/spending', auth, authorizeRoles('admin', 'superadmin'), getUserSpendingSummary)


module.exports = router
