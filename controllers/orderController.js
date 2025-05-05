const Order = require('../models/Order')
const Product = require('../models/Product')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const royalMailAPI = require('../utils/royalMailAPI')
const sendEmail = require('../utils/sendEmail')
const User = require('../models/User')
const { updateStockFromOrder } = require('./productControllerS3')
const mongoose = require('mongoose')


const getOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, startDate, endDate, startMonth, endMonth } = req.query

    const query = {}

    if (req.user.role === 'customer') {
      query.userId = req.user.id
    }

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      }
    }

    if (startMonth && endMonth) {
      const startMonthDate = new Date(startMonth)
      const endMonthDate = new Date(endMonth)
      endMonthDate.setMonth(endMonthDate.getMonth() + 1)
      query.createdAt = {
        $gte: startMonthDate,
        $lt: endMonthDate,
      }
    }

    const totalOrders = await Order.countDocuments(query)


    const orders = await Order.find(query)
      .populate('items.productId')
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))


    res.json({
      message: 'Orders fetched successfully',
      data: orders,
      totalOrders,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalOrders / limit),
    })
  } catch (error) {
    res.status(500).json({
      message: 'Something went wrong while fetching orders',
      error: error.message,
    })
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
  // try {
  //   const shippingAddress = req.body.shippingAddress
  //   const shippingRates = await royalMailAPI.getShippingRates(shippingAddress)
  //   res.json({ data: shippingRates, message: 'Shipping rates fetched successfully'})
  // } catch (error) {
  //   res.status(500).json({ message: 'Server error', error: error.message })
  // }
  const shippingRates = 5
  res.status(200).json({data: shippingRates, message: 'Shipping rate fetched successfully'})
}


// const createOrder = async (req, res) => {
//   const { shippingAddress, billingAddress, paymentMethod, cartItems } = req.body

//   try {
//     if (!cartItems || cartItems.length === 0) {
//       return res.status(400).json({ message: 'Cart is empty' })
//     }

//     const orderItems = await Promise.all(
//       cartItems.map(async (item) => {
//         const product = await Product.findById(item.productId)
//         if (!product) {
//           throw new Error(`Product with ID ${item.productId} not found`)
//         }
//         const color = product.colors.find((c) => c.name === item.color)
//         if (!color) {
//           throw new Error(`Color ${item.color} not found for product ${product.name}`)
//         }
//         const size = color.sizes.find((s) => s.name === item.size)
//         if (!size || size.quantity < item.quantity) {
//           throw new Error(`Insufficient quantity for size ${item.size} of product ${product.name}`)
//         }
//         return {
//           productId: item.productId,
//           productName: product.name,
//           color: item.color,
//           size: item.size,
//           quantity: item.quantity,
//           price: parseFloat(product.price.toFixed(2)),
//         }
//       })
//     )

//     // const shippingRates = await royalMailAPI.getShippingRates(shippingAddress)
//     // const shippingPrice = shippingRates.rates[0].value

//     const shippingPrice = parseFloat((5).toFixed(2))
//     const itemsPrice = orderItems.reduce((total, item) => total + item.price * item.quantity, 0)
//     const formattedItemsPrice = parseFloat(itemsPrice.toFixed(2))
//     const taxPrice = parseFloat((0.1 * formattedItemsPrice).toFixed(2))
//     const totalPrice = parseFloat((formattedItemsPrice + shippingPrice + taxPrice).toFixed(2))

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

//     // Send detailed email to the customer
//     const user = await User.findById(req.user.id)
//     const orderItemsHtml = `
//   <table style="border-collapse: collapse; width: 100%; text-align: left;">
//     <thead>
//       <tr style="background-color: #f2f2f2;">
//         <th style="border: 1px solid #ddd; padding: 8px;">Quantity</th>
//         <th style="border: 1px solid #ddd; padding: 8px;">Color</th>
//         <th style="border: 1px solid #ddd; padding: 8px;">Size</th>
//         <th style="border: 1px solid #ddd; padding: 8px;">Product</th>
//         <th style="border: 1px solid #ddd; padding: 8px;">Price</th>
//       </tr>
//     </thead>
//     <tbody>
//       ${orderItems
//         .map(
//           (item) =>
//             `<tr><td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.quantity}</td><td style="border: 1px solid #ddd; padding: 8px;">${item.color}</td><td style="border: 1px solid #ddd; padding: 8px;">${item.size}</td><td style="border: 1px solid #ddd; padding: 8px;">${item.productName}</td><td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${item.price}</td></tr>`
//         )
//         .join('')}
//     </tbody>
//   </table>
// `
//     const message = `
//   <h1>Order Confirmation</h1>
//   <p>Dear ${user.name},</p>
//   <p>Thank you for your order! Here are the details:</p>
//   ${orderItemsHtml}
//   <p>Shipping Address: ${shippingAddress.name}, ${shippingAddress.line1}, ${shippingAddress.line2}, ${shippingAddress.city}, ${shippingAddress.state}, ${shippingAddress.country}, ${shippingAddress.postal_code}</p>
//   <p>Billing Address: ${billingAddress.name}, ${billingAddress.line1}, ${billingAddress.line2}, ${billingAddress.city}, ${billingAddress.state}, ${billingAddress.country}, ${billingAddress.postal_code}</p>
//   <p>Payment Method: ${paymentMethod}</p>
//   <p>Items Total: ${formattedItemsPrice}</p>
//   <p>Shipping: ${shippingPrice}</p>
//   <p>Tax: ${taxPrice}</p>
//   <p>Total: ${totalPrice}</p>
//   <p>Your order will be shipped shortly. Thank you for shopping with us!</p>
// `

//     try {
//       await sendEmail({
//         to: user.email,
//         subject: 'Order Confirmation',
//         text: message,
//       })
//     } catch (error) {
//       console.error('Error sending order confirmation email:', error.message)
//     }

//     res.status(201).json({
//       message: 'Order placed successfully, a email was sent to your registered email address with the order details.',
//       data: createdOrder,
//     })
//   } catch (error) {
//     res.status(500).json({ message: 'Server error', error: error.message })
//   }
// }

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
          productName: product.name,
          color: item.color,
          size: item.size,
          quantity: item.quantity,
          price: parseFloat(product.price.toFixed(2)),
        }
      })
    )

    // const shippingRates = await royalMailAPI.getShippingRates(shippingAddress)
    // const shippingPrice = shippingRates.rates[0].value

    const shippingPrice = parseFloat((5).toFixed(2))
    const itemsPrice = orderItems.reduce((total, item) => total + item.price * item.quantity, 0)
    const formattedItemsPrice = parseFloat(itemsPrice.toFixed(2))
    const taxPrice = parseFloat((0.1 * formattedItemsPrice).toFixed(2))
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

    // Update stock levels after order creation
    try {
      await updateStockFromOrder(createdOrder._id, orderItems, 'decrease')
    } catch (stockError) {
      console.error('Error updating stock levels:', stockError)
      // Continue with order process even if stock update fails
      // Could log this for admin review
    }

    // Send detailed email to the customer
    const user = await User.findById(req.user.id)
    const orderItemsHtml = `
  <table style="border-collapse: collapse; width: 100%; text-align: left;">
    <thead>
      <tr style="background-color: #f2f2f2;">
        <th style="border: 1px solid #ddd; padding: 8px;">Quantity</th>
        <th style="border: 1px solid #ddd; padding: 8px;">Color</th>
        <th style="border: 1px solid #ddd; padding: 8px;">Size</th>
        <th style="border: 1px solid #ddd; padding: 8px;">Product</th>
        <th style="border: 1px solid #ddd; padding: 8px;">Price</th>
      </tr>
    </thead>
    <tbody>
      ${orderItems
        .map(
          (item) =>
            `<tr><td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.quantity}</td><td style="border: 1px solid #ddd; padding: 8px;">${item.color}</td><td style="border: 1px solid #ddd; padding: 8px;">${item.size}</td><td style="border: 1px solid #ddd; padding: 8px;">${item.productName}</td><td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${item.price}</td></tr>`
        )
        .join('')}
    </tbody>
  </table>
`
    const message = `
  <h1>Order Confirmation</h1>
  <p>Dear ${user.name},</p>
  <p>Thank you for your order! Here are the details:</p>
  ${orderItemsHtml}
  <p>Shipping Address: ${shippingAddress.name}, ${shippingAddress.line1}, ${shippingAddress.line2}, ${shippingAddress.city}, ${shippingAddress.state}, ${shippingAddress.country}, ${shippingAddress.postal_code}</p>
  <p>Billing Address: ${billingAddress.name}, ${billingAddress.line1}, ${billingAddress.line2}, ${billingAddress.city}, ${billingAddress.state}, ${billingAddress.country}, ${billingAddress.postal_code}</p>
  <p>Payment Method: ${paymentMethod}</p>
  <p>Items Total: ${formattedItemsPrice}</p>
  <p>Shipping: ${shippingPrice}</p>
  <p>Tax: ${taxPrice}</p>
  <p>Total: ${totalPrice}</p>
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
      message: 'Order placed successfully, a email was sent to your registered email address with the order details.',
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
      labelUrl: shippingLabel.labelUrl,
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

// webhook to handle Stripe payment success events
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

// const updateOrderToDelivered = async (req, res) => {
//   try {
//     const order = await Order.findById(req.params.id)
//     if (!order) {
//       return res.status(404).json({ message: 'Order not found' })
//     }

//     const { orderStatus, paidStatus } = req.body

//     if (orderStatus && !['in store', 'dispatched', 'delivered', 'cancelled', 'refunded'].includes(orderStatus)) {
//       return res.status(400).json({ message: 'Invalid order status' })
//     }

//     if (paidStatus && !['pending', 'paid', 'refunded', 'on hold', 'processing'].includes(paidStatus)) {
//       return res.status(400).json({ message: 'Invalid payment status' })
//     }

//     // Update orderStatus and related fields
//     if (orderStatus) {
//       order.orderStatus = orderStatus

//       if (orderStatus === 'delivered') {
//         order.isDelivered = true
//         order.deliveredAt = Date.now()
//       } else if (orderStatus === 'cancelled' || orderStatus === 'refunded') {
//         order.isDelivered = false
//         order.deliveredAt = null
//       }

//       // If order is refunded, also update payment status
//       if (orderStatus === 'refunded' && order.paidStatus !== 'refunded') {
//         order.paidStatus = 'refunded'
//         order.isPaid = false
//         order.paidAt = null
//       }
//     }

//     // Update paidStatus and related fields
//     if (paidStatus) {
//       order.paidStatus = paidStatus

//       if (paidStatus === 'paid') {
//         order.isPaid = true
//         order.paidAt = Date.now()
//       } else if (paidStatus === 'refunded' || paidStatus === 'on hold' || paidStatus === 'pending') {
//         order.isPaid = false
//         order.paidAt = null
//       }

//       // If payment is refunded, also update order status
//       if (paidStatus === 'refunded' && order.orderStatus !== 'refunded') {
//         order.orderStatus = 'refunded'
//         order.isDelivered = false
//         order.deliveredAt = null
//       }
//     }

//     const updatedOrder = await order.save()

//     res.json({
//       message: 'Order updated successfully',
//       order: updatedOrder,
//     })
//   } catch (error) {
//     res.status(500).json({ message: 'Server error', error: error.message })
//   }
// }

const updateOrderToDelivered = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.productId')
    if (!order) {
      return res.status(404).json({ message: 'Order not found' })
    }

    const { orderStatus, paidStatus } = req.body
    const previousOrderStatus = order.orderStatus
    const previousPaidStatus = order.paidStatus

    if (orderStatus && !['in store', 'dispatched', 'delivered', 'cancelled', 'refunded'].includes(orderStatus)) {
      return res.status(400).json({ message: 'Invalid order status' })
    }

    if (paidStatus && !['pending', 'paid', 'refunded', 'on hold', 'processing'].includes(paidStatus)) {
      return res.status(400).json({ message: 'Invalid payment status' })
    }

    // Track if inventory should be returned to stock
    let shouldRestoreInventory = false

    // Update orderStatus and related fields
    if (orderStatus) {
      order.orderStatus = orderStatus

      // Check if order is being cancelled or refunded
      if ((orderStatus === 'cancelled' || orderStatus === 'refunded') && previousOrderStatus !== 'cancelled' && previousOrderStatus !== 'refunded') {
        // Only restore inventory if transitioning from a non-cancelled/refunded state
        shouldRestoreInventory = true
        order.isDelivered = false
        order.deliveredAt = null
      } else if (orderStatus === 'delivered') {
        order.isDelivered = true
        order.deliveredAt = Date.now()
      }

      // If order is refunded, also update payment status
      if (orderStatus === 'refunded' && order.paidStatus !== 'refunded') {
        order.paidStatus = 'refunded'
        order.isPaid = false
        order.paidAt = null
      }
    }

    // Update paidStatus and related fields
    if (paidStatus) {
      order.paidStatus = paidStatus

      if (paidStatus === 'paid') {
        order.isPaid = true
        order.paidAt = Date.now()
      } else if (paidStatus === 'refunded' || paidStatus === 'on hold' || paidStatus === 'pending') {
        order.isPaid = false
        order.paidAt = null
      }

      // If payment is refunded, also update order status
      if (paidStatus === 'refunded' && order.orderStatus !== 'refunded') {
        // Only restore inventory if transitioning from a non-refunded state
        if (previousPaidStatus !== 'refunded') {
          shouldRestoreInventory = true
        }
        order.orderStatus = 'refunded'
        order.isDelivered = false
        order.deliveredAt = null
      }
    }

    // Save the updated order
    const updatedOrder = await order.save()

    // Restore inventory if order was cancelled or refunded
    if (shouldRestoreInventory) {
      try {
        await updateStockFromOrder(order._id, order.items, 'increase')
        console.log(`Inventory restored for order ${order._id}`)
      } catch (stockError) {
        console.error('Error restoring inventory:', stockError)
        // Continue even if inventory restoration fails
        // This should be logged for admin review
      }
    }

    res.json({
      message: 'Order updated successfully',
      order: updatedOrder,
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const getShippingLabel = async (req, res) => {
  // try {
  //   const order = await Order.findById(req.params.id);

  //   if (!order) {
  //     return res.status(404).json({ message: 'Order not found' });
  //   }

  //   if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
  //     return res.status(403).json({ message: 'You are not a admin or superadmin, you dont have the privilege to access this' });
  //   }

  //   const labelUrl = order.shippingDetails.labelUrl;

  //   res.status(200).json({ data: labelUrl, message: 'Shipping label fetched successfully'});
  // } catch (error) {
  //   res.status(500).json({ message: 'Server error', error: error.message });
  // }

  res.status(200).json({ data: 'https://support.scurri.co.uk/hc/article_attachments/202482725', message: 'Shipping label fetched successfully' })
};

// // Get all orders for a specific user
// const getUserOrders = async (req, res) => {
//   try {
//     const { userId } = req.params
//     const { page = 1, limit = 10 } = req.query
    
//     // Validate that the requester is an admin or superadmin
//     if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
//       return res.status(403).json({ message: 'Unauthorized access', error: 'You do not have permission to access these orders' })
//     }
    
//     const query = { userId }
    
//     const totalOrders = await Order.countDocuments(query)
    
//     const orders = await Order.find(query)
//       .populate('items.productId')
//       .populate('userId', 'name email')
//       .sort({ createdAt: -1 })
//       .skip((page - 1) * limit)
//       .limit(parseInt(limit))
    
//     res.json({
//       message: 'User orders fetched successfully',
//       data: orders,
//       totalOrders,
//       currentPage: parseInt(page),
//       totalPages: Math.ceil(totalOrders / limit),
//     })
//   } catch (error) {
//     res.status(500).json({
//       message: 'Something went wrong while fetching user orders',
//       error: error.message,
//     })
//   }
// }

// // Get user spending summary
// const getUserSpendingSummary = async (req, res) => {
//   try {
//     const { userId } = req.params
    
//     // Validate that the requester is an admin or superadmin
//     if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
//       return res.status(403).json({ message: 'Unauthorized access', error: 'You do not have permission to access this information' })
//     }
    
//     // Get the user details
//     const user = await User.findById(userId).select('name email')
    
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' })
//     }
    
//     // Get the summary of user's orders and spending
//     const summary = await Order.aggregate([
//       { $match: { userId: mongoose.Types.ObjectId(userId) } },
//       {
//         $facet: {
//           totalOrders: [{ $count: 'count' }],
//           totalSpent: [
//             {
//               $group: {
//                 _id: null,
//                 total: { $sum: '$totalPrice' },
//               },
//             },
//           ],
//           completedOrders: [
//             { $match: { isDelivered: true } },
//             { $count: 'count' },
//           ],
//           paidOrders: [
//             { $match: { isPaid: true } },
//             { $count: 'count' },
//           ],
//           averageOrderValue: [
//             {
//               $group: {
//                 _id: null,
//                 average: { $avg: '$totalPrice' },
//               },
//             },
//           ],
//           lastOrder: [
//             { $sort: { createdAt: -1 } },
//             { $limit: 1 },
//             {
//               $project: {
//                 _id: 1,
//                 totalPrice: 1,
//                 createdAt: 1,
//               },
//             },
//           ],
//           productsPurchased: [
//             { $unwind: '$items' },
//             {
//               $group: {
//                 _id: null,
//                 total: { $sum: '$items.quantity' },
//               },
//             },
//           ],
//           mostRecentOrders: [
//             { $sort: { createdAt: -1 } },
//             { $limit: 5 },
//             {
//               $project: {
//                 _id: 1,
//                 totalPrice: 1,
//                 createdAt: 1,
//                 isPaid: 1,
//                 isDelivered: 1,
//                 orderStatus: 1,
//               },
//             },
//           ],
//         },
//       },
//     ])
    
//     const result = {
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email,
//       },
//       spending: {
//         totalOrders: summary[0].totalOrders[0]?.count || 0,
//         totalSpent: summary[0].totalSpent[0]?.total || 0,
//         completedOrders: summary[0].completedOrders[0]?.count || 0,
//         paidOrders: summary[0].paidOrders[0]?.count || 0,
//         averageOrderValue: summary[0].averageOrderValue[0]?.average || 0,
//         totalProducts: summary[0].productsPurchased[0]?.total || 0,
//         lastOrder: summary[0].lastOrder[0] || null,
//         recentOrders: summary[0].mostRecentOrders || [],
//       },
//     }
    
//     res.json({
//       message: 'User spending summary fetched successfully',
//       data: result,
//     })
//   } catch (error) {
//     res.status(500).json({
//       message: 'Something went wrong while fetching user spending summary',
//       error: error.message,
//     })
//   }
// }

// Get all orders for a specific user (admin only)
const getUserOrders = async (req, res) => {
  try {
    const { userId } = req.params
    const { page = 1, limit = 10, startDate, endDate } = req.query
    
    
    
    const query = { userId }
    
    // Add date filters if provided
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      }
    }
    
    // Check if user exists
    const user = await User.findById(userId).select('name email')
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }
    
    const totalOrders = await Order.countDocuments(query)
    
    const orders = await Order.find(query)
      .populate('items.productId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
    
    res.json({
      message: `Orders for user ${user.name} fetched successfully`,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        },
        orders,
        totalOrders,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalOrders / limit)
      }
    })
  } catch (error) {
    res.status(500).json({
      message: 'Something went wrong while fetching user orders',
      error: error.message,
    })
  }
}

const getUserSpendingSummary = async (req, res) => {
  try {
    const { userId } = req.params

    // Check if user exists
    const user = await User.findById(userId).select('name email')
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Get overall spending summary with proper ObjectId handling
    const summary = await Order.aggregate([
      // Need to use new mongoose.Types.ObjectId for aggregation
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $facet: {
          // Overall statistics
          overallStats: [
            {
              $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                totalSpent: { $sum: '$totalPrice' },
                averageOrderValue: { $avg: '$totalPrice' },
                firstOrderDate: { $min: '$createdAt' },
                lastOrderDate: { $max: '$createdAt' },
              },
            },
          ],

          // Order status breakdown
          orderStatusBreakdown: [
            {
              $group: {
                _id: '$orderStatus',
                count: { $sum: 1 },
                value: { $sum: '$totalPrice' },
              },
            },
          ],

          // Payment status breakdown
          paymentStatusBreakdown: [
            {
              $group: {
                _id: '$paidStatus',
                count: { $sum: 1 },
                value: { $sum: '$totalPrice' },
              },
            },
          ],

          // Monthly spending trend (last 12 months)
          monthlySpending: [
            {
              $match: {
                createdAt: { $gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1)) },
              },
            },
            {
              $group: {
                _id: {
                  year: { $year: '$createdAt' },
                  month: { $month: '$createdAt' },
                },
                totalSpent: { $sum: '$totalPrice' },
                orderCount: { $sum: 1 },
              },
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
          ],

          // Most purchased products
          mostPurchasedProducts: [
            { $unwind: '$items' },
            {
              $group: {
                _id: '$items.productId',
                productName: { $first: '$items.productName' },
                totalQuantity: { $sum: '$items.quantity' },
                totalSpent: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
                orderCount: { $sum: 1 },
              },
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 10 },
          ],

          // Recent orders
          recentOrders: [
            { $sort: { createdAt: -1 } },
            { $limit: 5 },
            {
              $project: {
                _id: 1,
                createdAt: 1,
                totalPrice: 1,
                orderStatus: 1,
                paidStatus: 1,
                itemCount: { $size: '$items' },
              },
            },
          ],
        },
      },
    ])

    // Calculate customer lifetime value and other business metrics
    const overallStats = summary[0].overallStats[0] || {
      totalOrders: 0,
      totalSpent: 0,
      averageOrderValue: 0,
    }

    // Calculate days since first order
    let daysSinceFirstOrder = 0
    let customerLifetimeValue = 0

    if (overallStats.firstOrderDate) {
      daysSinceFirstOrder = Math.round((new Date() - new Date(overallStats.firstOrderDate)) / (1000 * 60 * 60 * 24))
      customerLifetimeValue = overallStats.totalSpent
    }

    // Format the response
    const formattedSummary = {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      lifetime: {
        totalOrders: overallStats.totalOrders || 0,
        totalSpent: overallStats.totalSpent || 0,
        averageOrderValue: overallStats.averageOrderValue || 0,
        firstOrderDate: overallStats.firstOrderDate,
        lastOrderDate: overallStats.lastOrderDate,
        daysSinceFirstOrder,
        customerLifetimeValue,
      },
      orderStatusBreakdown: summary[0].orderStatusBreakdown,
      paymentStatusBreakdown: summary[0].paymentStatusBreakdown,
      monthlySpending: summary[0].monthlySpending.map((month) => ({
        year: month._id.year,
        month: month._id.month,
        totalSpent: month.totalSpent,
        orderCount: month.orderCount,
      })),
      mostPurchasedProducts: summary[0].mostPurchasedProducts,
      recentOrders: summary[0].recentOrders,
    }

    res.json({
      message: `Spending summary for user ${user.name} generated successfully`,
      data: formattedSummary,
    })
  } catch (error) {
    console.error('Error in getUserSpendingSummary:', error)
    res.status(500).json({
      message: 'Something went wrong while generating user spending summary',
      error: error.message,
    })
  }
}


const getOrderStats = async (req, res) => {
  try {
    const { startDate, endDate, startMonth, endMonth, month, year } = req.query

    let matchQuery = {}

    if (startDate && endDate) {
      matchQuery.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) }
    } else if (startMonth && endMonth) {
      const startMonthDate = new Date(startMonth)
      const endMonthDate = new Date(endMonth)
      endMonthDate.setMonth(endMonthDate.getMonth() + 1)
      matchQuery.createdAt = { $gte: startMonthDate, $lt: endMonthDate }
    } else if (month && year) {
      const startOfMonth = new Date(year, month - 1, 1)
      const endOfMonth = new Date(year, month, 0)
      matchQuery.createdAt = { $gte: startOfMonth, $lte: endOfMonth }
    } else {
      const currentDate = new Date()
      const currentMonth = currentDate.getMonth()
      const currentYear = currentDate.getFullYear()
      const startOfMonth = new Date(currentYear, currentMonth, 1)
      const endOfMonth = new Date(currentYear, currentMonth + 1, 0)
      matchQuery.createdAt = { $gte: startOfMonth, $lte: endOfMonth }
    }

    const stats = await Order.aggregate([
      {
        $match: matchQuery,
      },
      {
        $facet: {
          totalOrders: [{ $count: 'count' }],
          totalSalesAmount: [
            {
              $group: {
                _id: null,
                totalAmount: { $sum: '$totalPrice' },
              },
            },
          ],
          totalConfirmedDeliveredOrders: [
            {
              $match: { isDelivered: true },
            },
            { $count: 'count' },
          ],
          totalPaymentConfirmedOrders: [
            {
              $match: { isPaid: true },
            },
            { $count: 'count' },
          ],
          shippingPendingOrders: [
            {
              $match: { isPaid: true, isDelivered: false },
            },
            {
              $lookup: {
                from: 'products',
                localField: 'items.productId',
                foreignField: '_id',
                as: 'items.productId',
              },
            },
          ],
        },
      },
    ])

    res.json({
      totalOrders: stats[0].totalOrders[0]?.count || 0,
      totalSalesAmount: stats[0].totalSalesAmount[0]?.totalAmount || 0,
      totalConfirmedDeliveredOrders: stats[0].totalConfirmedDeliveredOrders[0]?.count || 0,
      totalPaymentConfirmedOrders: stats[0].totalPaymentConfirmedOrders[0]?.count || 0,
      shippingPendingOrders: stats[0].shippingPendingOrders,
    })
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
  getShippingLabel,
  getUserOrders,
  getUserSpendingSummary,
  getOrderStats,
}