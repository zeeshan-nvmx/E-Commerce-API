const express = require('express')
const router = express.Router()
const { getOrders, getOrderById, createOrder, updateOrderToPaid, updateOrderToDelivered } = require('../controllers/orderController')
const auth = require('../middleware/auth')

router.route('/').get(auth, getOrders).post(auth, createOrder)
router.route('/:id').get(auth, getOrderById)
router.route('/:id/pay').put(auth, updateOrderToPaid)
router.route('/:id/deliver').put(auth, updateOrderToDelivered)

module.exports = router
