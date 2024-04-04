const mongoose = require('mongoose')
const { Schema } = mongoose

const categorySchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
  },
  image: {
    type: String,
  },
  isSubcategory: {
    type: Boolean,
    default: false,
  },
  parentCategory: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    default: null,
  },
})

const Category = mongoose.model('Category', categorySchema)
module.exports = Category
