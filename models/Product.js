// models/Product.js (updated)
const mongoose = require('mongoose')

const stockHistoryEntrySchema = new mongoose.Schema({
  date: {
    type: Date,
    default: Date.now,
    required: true,
  },
  previousQuantity: {
    type: Number,
    required: true,
  },
  newQuantity: {
    type: Number,
    required: true,
  },
  change: {
    type: Number,
    required: true,
  },
  reason: {
    type: String,
    enum: ['sale', 'restock', 'return', 'adjustment', 'initial'],
    required: true,
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null,
  },
  note: String,
})

const sizeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    default: 0,
  },
  purchaseCost: {
    type: Number,
    default: 0,
  },
  history: [stockHistoryEntrySchema],
})

const colorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  image: {
    original: {
      type: String,
    },
    thumbnail: {
      type: String,
    },
  },
  sizes: [sizeSchema],
})

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  sku: {
    type: String,
    required: true,
    unique: true,
  },
  featured: {
    type: Boolean,
    default: false,
  },
  categories: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
  ],
  images: [
    {
      original: {
        type: String,
        required: true,
      },
      thumbnail: {
        type: String,
        required: true,
      },
    },
  ],
  colors: [colorSchema],
  stockDetails: {
    type: String,
    default: '',
  },
  totalInventoryCost: {
    type: Number,
    default: 0,
  },
  lastRestockDate: {
    type: Date,
  },
  supplier: {
    type: String,
  },
})

// Calculate total inventory cost before saving
productSchema.pre('save', function (next) {
  let totalCost = 0

  // Calculate total inventory cost across all colors and sizes
  this.colors.forEach((color) => {
    color.sizes.forEach((size) => {
      totalCost += size.purchaseCost * size.quantity
    })
  })

  this.totalInventoryCost = totalCost
  next()
})

productSchema.index({ name: 'text', description: 'text', sku: 'text' })

const Product = mongoose.model('Product', productSchema)

module.exports = Product

// const mongoose = require('mongoose')

// const sizeSchema = new mongoose.Schema({
//   name: {
//     type: String,
//     required: true,
//   },
//   quantity: {
//     type: Number,
//     required: true,
//     default: 0,
//   },
// })

// const colorSchema = new mongoose.Schema({
//   name: {
//     type: String,
//     required: true,
//   },
//   image: {
//     original: {
//       type: String,
//     },
//     thumbnail: {
//       type: String,
//     },
//   },
//   sizes: [sizeSchema],
// })

// const productSchema = new mongoose.Schema({
//   name: {
//     type: String,
//     required: true,
//   },
//   description: {
//     type: String,
//     required: true,
//   },
//   price: {
//     type: Number,
//     required: true,
//   },
//   sku: {
//     type: String,
//     required: true,
//     unique: true,
//   },
//   featured: {
//     type: Boolean,
//     default: false,
//   },
//   categories: [
//     {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'Category',
//       required: true,
//     },
//   ],
//   images: [
//     {
//       original: {
//         type: String,
//         required: true,
//       },
//       thumbnail: {
//         type: String,
//         required: true,
//       },
//     },
//   ],
//   colors: [colorSchema],
// })

// productSchema.index({ name: 'text', description: 'text', sku: 'text' })

// const Product = mongoose.model('Product', productSchema)

// module.exports = Product
