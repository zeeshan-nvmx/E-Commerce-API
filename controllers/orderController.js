const Order = require('../models/Order');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const royalMailAPI = require('../utils/royalMailAPI');
const sendEmail = require('../utils/sendEmail');

const getOrders = async (req, res) => {
 try {
   const orders = await Order.find({ userId: req.user.id }).populate('items.productId');
   res.json(orders);
 } catch (error) {
   res.status(500).json({ message: 'Server error', error: error.message });
 }
};

const getOrderById = async (req, res) => {
 try {
   const order = await Order.findById(req.params.id).populate('items.productId');
   if (!order) {
     return res.status(404).json({ message: 'Order not found' });
   }
   res.json(order);
 } catch (error) {
   res.status(500).json({ message: 'Server error', error: error.message });
 }
};

const createOrder = async (req, res) => {
  const { shippingAddress, billingAddress, paymentMethod } = req.body

  try {
    const cart = await Cart.findOne({ userId: req.user.id }).populate('items.productId')
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' })
    }

    const orderItems = cart.items.map((item) => ({
      productId: item.productId._id,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      price: item.productId.price,
    }))

    const shippingRates = await royalMailAPI.getShippingRates(shippingAddress)
    const shippingPrice = shippingRates.rates[0].value

    const itemsPrice = orderItems.reduce((total, item) => total + item.price * item.quantity, 0)
    const taxPrice = 0.1 * itemsPrice // 10% tax
    const totalPrice = itemsPrice + shippingPrice + taxPrice

    const order = new Order({
      userId: req.user.id,
      items: orderItems,
      shippingAddress,
      billingAddress,
      paymentMethod,
      taxPrice,
      shippingPrice,
      totalPrice,
    })

    const createdOrder = await order.save()

    // Create a Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalPrice * 100),
      currency: 'gbp',
      metadata: { orderId: createdOrder._id.toString() },
    })

    res.status(201).json({
      order: createdOrder,
      paymentIntent: paymentIntent.client_secret,
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const updateOrderToPaid = async (req, res) => {
  const { orderId, paymentResult } = req.body

  try {
    const order = await Order.findById(orderId)
    if (!order) {
      return res.status(404).json({ message: 'Order not found' })
    }

    order.isPaid = true
    order.paidAt = Date.now()
    order.paymentResult = {
      id: paymentResult.id,
      status: paymentResult.status,
      update_time: paymentResult.update_time,
      email_address: paymentResult.payer.email_address,
    }

    const updatedOrder = await order.save()

    // Create a shipping label and get tracking details
    const shippingLabel = await royalMailAPI.createShippingLabel(
      order.shippingAddress,
      order.items.reduce((total, item) => total + item.quantity, 0)
    )

    updatedOrder.shippingDetails = {
      trackingNumber: shippingLabel.trackingNumber,
      carrier: shippingLabel.carrier,
      estimatedDeliveryDate: shippingLabel.estimatedDeliveryDate,
    }

    await updatedOrder.save()

    // Send order confirmation email to customer
    const mailOptions = {
      to: req.user.email,
      subject: 'Order Confirmation',
      text: `Your order (${orderId}) has been placed successfully. Total amount paid: ${order.totalPrice}`,
      html: `
       <h1>Order Confirmation</h1>
       <p>Your order (${orderId}) has been placed successfully.</p>
       <p>Total amount paid: ${order.totalPrice}</p>
       <p>Shipping details:</p>
       <ul>
         <li>Tracking Number: ${shippingLabel.trackingNumber}</li>
         <li>Carrier: ${shippingLabel.carrier}</li>
         <li>Estimated Delivery Date: ${shippingLabel.estimatedDeliveryDate}</li>
       </ul>
     `,
    }

    await sendEmail(mailOptions)

    res.json({ message: 'Order paid successfully', order: updatedOrder })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const updateOrderToDelivered = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) {
      return res.status(404).json({ message: 'Order not found' })
    }

    order.isDelivered = true
    order.deliveredAt = Date.now()

    const updatedOrder = await order.save()

    res.json({ message: 'Order delivered successfully', order: updatedOrder })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

module.exports = {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderToPaid,
  updateOrderToDelivered,
}