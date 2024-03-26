const Cart = require('../models/Cart')
const Product = require('../models/Product')

const getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id }).populate('items.productId')
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' })
    }
    res.json(cart)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const addToCart = async (req, res) => {
  const { productId, color, size, quantity } = req.body

  try {
    const product = await Product.findById(productId)
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    const colorData = product.colors.find((c) => c.name === color)
    if (!colorData) {
      return res.status(400).json({ message: 'Invalid color' })
    }

    const sizeData = colorData.sizes.find((s) => s.name === size)
    if (!sizeData || sizeData.quantity < quantity) {
      return res.status(400).json({ message: 'Invalid size or quantity' })
    }

    let cart = await Cart.findOne({ userId: req.user.id })
    if (!cart) {
      cart = new Cart({ userId: req.user.id, items: [] })
    }

    const itemIndex = cart.items.findIndex((item) => item.productId.toString() === productId && item.color === color && item.size === size)

    if (itemIndex !== -1) {
      cart.items[itemIndex].quantity += quantity
    } else {
      cart.items.push({ productId, color, size, quantity })
    }

    await cart.save()
    res.json(cart)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const updateCartItem = async (req, res) => {
  const { quantity } = req.body

  try {
    const cart = await Cart.findOne({ userId: req.user.id })
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' })
    }

    const itemIndex = cart.items.findIndex((item) => item._id.toString() === req.params.itemId)
    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Cart item not found' })
    }

    const product = await Product.findById(cart.items[itemIndex].productId)
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    const colorData = product.colors.find((c) => c.name === cart.items[itemIndex].color)
    if (!colorData) {
      return res.status(400).json({ message: 'Invalid color' })
    }

    const sizeData = colorData.sizes.find((s) => s.name === cart.items[itemIndex].size)
    if (!sizeData || sizeData.quantity < quantity) {
      return res.status(400).json({ message: 'Invalid size or quantity' })
    }

    cart.items[itemIndex].quantity = quantity
    await cart.save()
    res.json(cart)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const removeFromCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id })
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' })
    }

    const itemIndex = cart.items.findIndex((item) => item._id.toString() === req.params.itemId)
    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Cart item not found' })
    }

    cart.items.splice(itemIndex, 1)
    await cart.save()
    res.json(cart)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
}
