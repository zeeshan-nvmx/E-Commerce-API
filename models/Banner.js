const mongoose = require('mongoose')

const bannerSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    linkUrl: String,
    backgroundColor: String,
    textColor: String,
  },
  { timestamps: true }
)

module.exports = mongoose.model('Banner', bannerSchema)
