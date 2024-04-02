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
    type: String,
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
  categories: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
  ],
  images: [
    {
      type: String,
    },
  ],
  colors: [colorSchema],
})

productSchema.index({ name: 'text', description: 'text' })

const Product = mongoose.model('Product', productSchema)

module.exports = Product
