// models/Blog.js
const mongoose = require('mongoose')
const { Schema } = mongoose

const blogSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
  },
  summary: {
    type: String,
  },
  coverImage: {
    type: String,
  },
  coverImageThumbnail: {
    type: String,
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  published: {
    type: Boolean,
    default: false,
  },
  publishedAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  tags: [String],
})

// Update the updatedAt field before each save
blogSchema.pre('save', function (next) {
  this.updatedAt = Date.now()
  next()
})

// Add a text index for searching
blogSchema.index({ title: 'text', content: 'text', summary: 'text', tags: 'text' })

const Blog = mongoose.model('Blog', blogSchema)
module.exports = Blog
