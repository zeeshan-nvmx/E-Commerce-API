const Order = require('../models/Order')
const Product = require('../models/Product')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const royalMailAPI = require('../utils/royalMailAPI')
const sendEmail = require('../utils/sendEmail')

const getOrders = async (req, res) => {
  try {
    let orders
    if (req.user.role === 'user') {
      orders = await Order.find({ userId: req.user.id }).populate('items.productId')
    } else {
      orders = await Order.find().populate('items.productId')
    }

    res.json({ message: 'Orders fetched successfully', data: orders })
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong while fetching orders', error: error.message })
  }
}

const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.productId')

    if (!order) {
      return res.status(404).json({ message: 'Order not found', error: 'The requested order could not be found' })
    }

    if (req.user.role === 'user' && order.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized access', error: 'You do not have permission to access this order' })
    }

    res.json({ message: 'Order fetched successfully', data: order })
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong while fetching the order', error: error.message })
  }
}

const getShippingRates = async (req, res) => {
  try {
    const shippingAddress = req.body.shippingAddress
    const shippingRates = await royalMailAPI.getShippingRates(shippingAddress)
    res.json(shippingRates)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

/*
const createOrder = async (req, res) => {
  const { shippingAddress, billingAddress, paymentMethod, cartItems } = req.body

  try {
    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' })
    }

    const orderItems = await Promise.all(
      cartItems.map(async (item) => {
        const product = await Product.findById(item.productId)
        if (!product) {
          throw new Error(`Product with ID ${item.productId} not found`)
        }

        const color = product.colors.find((c) => c.name === item.color)
        if (!color) {
          throw new Error(`Color ${item.color} not found for product ${product.name}`)
        }

        const size = color.sizes.find((s) => s.name === item.size)
        if (!size || size.quantity < item.quantity) {
          throw new Error(`Insufficient quantity for size ${item.size} of product ${product.name}`)
        }

        return {
          productId: item.productId,
          color: item.color,
          size: item.size,
          quantity: item.quantity,
          price: parseFloat(product.price.toFixed(2)), // Ensure price is formatted correctly
        }
      })
    )

    // const shippingRates = await royalMailAPI.getShippingRates(shippingAddress)
    // const shippingPrice = shippingRates.rates[0].value

    const shippingPrice = parseFloat((5).toFixed(2)) // Temporary shipping price

    const itemsPrice = orderItems.reduce((total, item) => total + item.price * item.quantity, 0)
    const formattedItemsPrice = parseFloat(itemsPrice.toFixed(2)) 

    const taxPrice = parseFloat((0.1 * formattedItemsPrice).toFixed(2)) // 10% tax
    const totalPrice = parseFloat((formattedItemsPrice + shippingPrice + taxPrice).toFixed(2)) 

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
    // const paymentIntent = await stripe.paymentIntents.create({
    //   amount: Math.round(totalPrice * 100),
    //   currency: 'gbp',
    //   metadata: { orderId: createdOrder._id.toString() },
    // })

    res.status(201).json({ message: 'Order placed successfully', data: createdOrder, // paymentIntent: paymentIntent.client_secret,
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}
*/

const createOrder = async (req, res) => {
  const { shippingAddress, billingAddress, paymentMethod, cartItems } = req.body

  try {
    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' })
    }

    const orderItems = await Promise.all(
      cartItems.map(async (item) => {
        const product = await Product.findById(item.productId)
        if (!product) {
          throw new Error(`Product with ID ${item.productId} not found`)
        }
        const color = product.colors.find((c) => c.name === item.color)
        if (!color) {
          throw new Error(`Color ${item.color} not found for product ${product.name}`)
        }
        const size = color.sizes.find((s) => s.name === item.size)
        if (!size || size.quantity < item.quantity) {
          throw new Error(`Insufficient quantity for size ${item.size} of product ${product.name}`)
        }
        return {
          productId: item.productId,
          color: item.color,
          size: item.size,
          quantity: item.quantity,
          price: parseFloat(product.price.toFixed(2)), // Ensure price is formatted correctly
        }
      })
    )

    const shippingPrice = parseFloat((5).toFixed(2)) // Temporary shipping price
    const itemsPrice = orderItems.reduce((total, item) => total + item.price * item.quantity, 0)
    const formattedItemsPrice = parseFloat(itemsPrice.toFixed(2))
    const taxPrice = parseFloat((0.1 * formattedItemsPrice).toFixed(2)) // 10% tax
    const totalPrice = parseFloat((formattedItemsPrice + shippingPrice + taxPrice).toFixed(2))

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

    // Send detailed email to the customer
    const user = await User.findById(req.user.id)
    const orderItemsHtml = orderItems.map((item) => `<li>${item.quantity} x ${item.color} ${item.size} ${item.productId} - $${item.price}</li>`)
    const message = `
      <h1>Order Confirmation</h1>
      <p>Dear ${user.name},</p>
      <p>Thank you for your order! Here are the details:</p>
      <ul>
        ${orderItemsHtml.join('')}
      </ul>
      <p>Shipping Address: ${shippingAddress.address}, ${shippingAddress.city}, ${shippingAddress.postalCode}, ${shippingAddress.country}</p>
      <p>Billing Address: ${billingAddress.address}, ${billingAddress.city}, ${billingAddress.postalCode}, ${billingAddress.country}</p>
      <p>Payment Method: ${paymentMethod}</p>
      <p>Items Total: $${formattedItemsPrice}</p>
      <p>Shipping: $${shippingPrice}</p>
      <p>Tax: $${taxPrice}</p>
      <p>Total: $${totalPrice}</p>
      <p>Your order will be shipped shortly. Thank you for shopping with us!</p>
    `

    try {
      await sendEmail({
        to: user.email,
        subject: 'Order Confirmation',
        text: message,
      })
    } catch (error) {
      console.error('Error sending order confirmation email:', error.message)
    }

    res.status(201).json({
      message: 'Order placed successfully',
      data: createdOrder,
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}



const handlePaymentSuccess = async (paymentIntent) => {
  try {
    const orderId = paymentIntent.metadata.orderId
    const order = await Order.findById(orderId)

    if (!order) {
      throw new Error('Order not found')
    }

    order.isPaid = true
    order.paidAt = Date.now()
    order.paymentResult = {
      id: paymentIntent.id,
      status: paymentIntent.status,
      update_time: paymentIntent.created,
      email_address: paymentIntent.charges.data[0].billing_details.email,
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
      to: paymentIntent.charges.data[0].billing_details.email,
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
  } catch (error) {
    console.error('Error handling payment success:', error)
  }
}

// Set up a webhook to handle Stripe payment success events
const stripe_webhook = async (req, res) => {
  const signature = req.headers['stripe-signature']
  let event

  try {
    event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook error:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object
    await handlePaymentSuccess(paymentIntent)
  } else {
    console.log(`Unhandled event type ${event.type}`)
  }

  res.status(200).json({ received: true })
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
  getShippingRates,
  createOrder,
  stripe_webhook,
  updateOrderToDelivered,
}

// const Order = require('../models/Order')
// const Product = require('../models/Product')
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
// const royalMailAPI = require('../utils/royalMailAPI')
// const sendEmail = require('../utils/sendEmail')

// const getOrders = async (req, res) => {
//   try {
//     const orders = await Order.find({ userId: req.user.id }).populate('items.productId')
//     res.json(orders)
//   } catch (error) {
//     res.status(500).json({ message: 'Server error', error: error.message })
//   }
// }

// const getOrderById = async (req, res) => {
//   try {
//     const order = await Order.findById(req.params.id).populate('items.productId')
//     if (!order) {
//       return res.status(404).json({ message: 'Order not found' })
//     }
//     res.json(order)
//   } catch (error) {
//     res.status(500).json({ message: 'Server error', error: error.message })
//   }
// }

// const getShippingRates = async (req, res) => {
//   try {
//     const shippingAddress = req.body.shippingAddress
//     const shippingRates = await royalMailAPI.getShippingRates(shippingAddress)
//     res.json(shippingRates)
//   } catch (error) {
//     res.status(500).json({ message: 'Server error', error: error.message })
//   }
// }

// const createOrder = async (req, res) => {
//   const { shippingAddress, billingAddress, paymentMethod } = req.body

//   try {
//     const cart = await Cart.findOne({ userId: req.user.id }).populate('items.productId')
//     if (!cart || cart.items.length === 0) {
//       return res.status(400).json({ message: 'Cart is empty' })
//     }

//     const orderItems = cart.items.map((item) => ({
//       productId: item.productId._id,
//       color: item.color,
//       size: item.size,
//       quantity: item.quantity,
//       price: item.productId.price,
//     }))

//     const shippingRates = await royalMailAPI.getShippingRates(shippingAddress)
//     const shippingPrice = shippingRates.rates[0].value

//     const itemsPrice = orderItems.reduce((total, item) => total + item.price * item.quantity, 0)
//     const taxPrice = 0.1 * itemsPrice // 10% tax
//     const totalPrice = itemsPrice + shippingPrice + taxPrice

//     const order = new Order({
//       userId: req.user.id,
//       items: orderItems,
//       shippingAddress,
//       billingAddress,
//       paymentMethod,
//       taxPrice,
//       shippingPrice,
//       totalPrice,
//     })

//     const createdOrder = await order.save()

//     // Create a Stripe payment intent
//     const paymentIntent = await stripe.paymentIntents.create({
//       amount: Math.round(totalPrice * 100),
//       currency: 'gbp',
//       metadata: { orderId: createdOrder._id.toString() },
//     })

//     res.status(201).json({
//       order: createdOrder,
//       paymentIntent: paymentIntent.client_secret,
//     })
//   } catch (error) {
//     res.status(500).json({ message: 'Server error', error: error.message })
//   }
// }

// const handlePaymentSuccess = async (paymentIntent) => {
//   try {
//     const orderId = paymentIntent.metadata.orderId
//     const order = await Order.findById(orderId)

//     if (!order) {
//       throw new Error('Order not found')
//     }

//     order.isPaid = true
//     order.paidAt = Date.now()
//     order.paymentResult = {
//       id: paymentIntent.id,
//       status: paymentIntent.status,
//       update_time: paymentIntent.created,
//       email_address: paymentIntent.charges.data[0].billing_details.email,
//     }

//     const updatedOrder = await order.save()

//     // Create a shipping label and get tracking details
//     const shippingLabel = await royalMailAPI.createShippingLabel(
//       order.shippingAddress,
//       order.items.reduce((total, item) => total + item.quantity, 0)
//     )

//     updatedOrder.shippingDetails = {
//       trackingNumber: shippingLabel.trackingNumber,
//       carrier: shippingLabel.carrier,
//       estimatedDeliveryDate: shippingLabel.estimatedDeliveryDate,
//     }

//     await updatedOrder.save()

//     // Send order confirmation email to customer
//     const mailOptions = {
//       to: paymentIntent.charges.data[0].billing_details.email,
//       subject: 'Order Confirmation',
//       text: `Your order (${orderId}) has been placed successfully. Total amount paid: ${order.totalPrice}`,
//       html: `
//         <h1>Order Confirmation</h1>
//         <p>Your order (${orderId}) has been placed successfully.</p>
//         <p>Total amount paid: ${order.totalPrice}</p>
//         <p>Shipping details:</p>
//         <ul>
//           <li>Tracking Number: ${shippingLabel.trackingNumber}</li>
//           <li>Carrier: ${shippingLabel.carrier}</li>
//           <li>Estimated Delivery Date: ${shippingLabel.estimatedDeliveryDate}</li>
//         </ul>
//       `,
//     }

//     await sendEmail(mailOptions)
//   } catch (error) {
//     console.error('Error handling payment success:', error)
//   }
// }

// // Set up a webhook to handle Stripe payment success events
// const stripe_webhook = async (req, res) => {
//   const signature = req.headers['stripe-signature']
//   let event

//   try {
//     event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET)
//   } catch (err) {
//     console.error('Webhook error:', err.message)
//     return res.status(400).send(`Webhook Error: ${err.message}`)
//   }

//   if (event.type === 'payment_intent.succeeded') {
//     const paymentIntent = event.data.object
//     await handlePaymentSuccess(paymentIntent)
//   } else {
//     console.log(`Unhandled event type ${event.type}`)
//   }

//   res.status(200).json({ received: true })
// }

// const updateOrderToDelivered = async (req, res) => {
//   try {
//     const order = await Order.findById(req.params.id)
//     if (!order) {
//       return res.status(404).json({ message: 'Order not found' })
//     }

//     order.isDelivered = true
//     order.deliveredAt = Date.now()

//     const updatedOrder = await order.save()

//     res.json({ message: 'Order delivered successfully', order: updatedOrder })
//   } catch (error) {
//     res.status(500).json({ message: 'Server error', error: error.message })
//   }
// }

// module.exports = {
//   getOrders,
//   getOrderById,
//   getShippingRates,
//   createOrder,
//   stripe_webhook,
//   updateOrderToDelivered,
// }

/*    
  const createOrder = async (req, res) => {
  const { shippingAddress, billingAddress, paymentMethod, cartItems } = req.body

  try {
    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' })
    }

    const orderItems = await Promise.all(
      cartItems.map(async (item) => {
        const product = await Product.findById(item.productId)
        if (!product) {
          throw new Error(`Product with ID ${item.productId} not found`)
        }

        const color = product.colors.find((c) => c.name === item.color)
        if (!color) {
          throw new Error(`Color ${item.color} not found for product ${product.name}`)
        }

        const size = color.sizes.find((s) => s.name === item.size)
        if (!size || size.quantity < item.quantity) {
          throw new Error(`Insufficient quantity for size ${item.size} of product ${product.name}`)
        }

        return {
          productId: item.productId,
          color: item.color,
          size: item.size,
          quantity: item.quantity,
          price: product.price,
        }
      })
    )

    // const shippingRates = await royalMailAPI.getShippingRates(shippingAddress)
    // const shippingPrice = shippingRates.rates[0].value

    const shippingPrice = 5 // Temporary shipping price

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
    // const paymentIntent = await stripe.paymentIntents.create({
    //   amount: Math.round(totalPrice * 100),
    //   currency: 'gbp',
    //   metadata: { orderId: createdOrder._id.toString() },
    // })

    res.status(201).json({
      order: createdOrder,
      // paymentIntent: paymentIntent.client_secret,
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}
*/