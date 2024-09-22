const mongoose = require('mongoose')

const heroSchema = new mongoose.Schema(
  {
    images: [String],
  },
  { timestamps: true }
)

module.exports = mongoose.model('Hero', heroSchema)
