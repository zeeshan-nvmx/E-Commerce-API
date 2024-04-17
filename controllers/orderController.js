const Order = require('../models/Order')
const Product = require('../models/Product')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const royalMailAPI = require('../utils/royalMailAPI')
const sendEmail = require('../utils/sendEmail')
const User = require('../models/User')

// const getOrders = async (req, res) => {
//   try {
//     let orders
//     if (req.user.role === 'customer') {
//       orders = await Order.find({ userId: req.user.id }).populate('items.productId').sort({ createdAt: -1 })
//     } else {
//       orders = await Order.find().populate('items.productId').sort({ createdAt: -1 })
//     }

//     res.json({ message: 'Orders fetched successfully', data: orders })
//   } catch (error) {
//     res.status(500).json({ message: 'Something went wrong while fetching orders', error: error.message })
//   }
// }

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
            `<tr><td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.quantity}</td><td style="border: 1px solid #ddd; padding: 8px;">${item.color}</td><td style="border: 1px solid #ddd; padding: 8px;">${item.size}</td><td style="border: 1px solid #ddd; padding: 8px;">${item.productName}</td><td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${item.price}</td></tr>`
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

// Get shipping label for an order
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
  getOrderStats
}