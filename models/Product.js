const mongoose = require('mongoose')

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
})

productSchema.index({ name: 'text', description: 'text', sku: 'text' })

const Product = mongoose.model('Product', productSchema)

module.exports = Product
