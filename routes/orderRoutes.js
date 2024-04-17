const express = require('express')
const router = express.Router()
const auth = require('../middleware/auth')
const { getOrders, getOrderById, getShippingRates, createOrder, stripe_webhook, updateOrderToDelivered, getShippingLabel, getOrderStats } = require('../controllers/orderController')

router.get('/', auth, getOrders)
router.get('/stats', auth, getOrderStats)
router.get('/:id', auth, getOrderById)
router.post('/shipping-rates', auth, getShippingRates)
router.post('/', auth, createOrder)
router.post('/stripe-webhook', stripe_webhook)
router.put('/:id/deliver', auth, updateOrderToDelivered)
router.get('/:id/shipping-label', auth, getShippingLabel)


module.exports = router
