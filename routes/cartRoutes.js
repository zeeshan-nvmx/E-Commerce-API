const express = require('express')
const router = express.Router()
const { getCart, addToCart, updateCartItem, removeFromCart } = require('../controllers/cartController')
const auth = require('../middleware/auth')

router.route('/').get(auth, getCart)
router.route('/add').post(auth, addToCart)
router.route('/:itemId').put(auth, updateCartItem).delete(auth, removeFromCart)

module.exports = router
