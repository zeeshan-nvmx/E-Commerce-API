const Product = require('../models/Product')
const Category = require('../models/Category')
const { uploadToGCS, deleteFromGCS } = require('../utils/gcs')
const { ObjectId } = require('mongodb')

const isValidObjectId = (id) => {
  return ObjectId.isValid(id)
}

const getProducts = async (req, res) => {
  try {
    const { categories, colors, sizes, page = 1, limit = 10 } = req.query
    const query = {}

    if (categories) {
      query.categories = { $in: categories.split(',') }
    }
    if (colors) {
      query['colors.name'] = { $in: colors.split(',') }
    }
    if (sizes) {
      query['colors.sizes.name'] = { $in: sizes.split(',') }
    }

    const skip = (page - 1) * limit
    const totalProducts = await Product.countDocuments(query)
    const products = await Product.find(query).skip(skip).limit(limit)

    const response = {
      data: {
        products,
        totalPages: Math.ceil(totalProducts / limit),
        currentPage: page,
      },
      message: `Products successfully fetched, Showing page ${page} of ${Math.ceil(totalProducts / limit)} pages.`,
    }

    res.json(response)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}


const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }
    res.json({
      data: product,
      message: 'Product was successfully fetched',
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const createProduct = async (req, res) => {
  const { name, description, price, categories, colors } = req.body

  try {
    let categoryIds = []

    const ids = categories.split(',').map((id) => id.trim())
    categoryIds = ids.filter(isValidObjectId).map((id) => ObjectId.createFromHexString(id))

    if (categoryIds.length === 0) {
      return res.status(400).json({ message: 'Invalid category IDs' })
    }

    const categoriesData = await Category.find({
      _id: { $in: categoryIds },
    })
    if (categoriesData.length !== categoryIds.length) {
      return res.status(400).json({ message: 'Invalid category IDs' })
    }

    const productImages = []
    if (req.files) {
      for (const file of req.files) {
        const imageUrl = await uploadToGCS(file, `products/${file.originalname}`)
        productImages.push(imageUrl)
      }
    }

    const product = await Product.create({
      name,
      description,
      price,
      categories: categoryIds,
      images: productImages,
      colors: JSON.parse(colors),
    })
    res.status(201).json(product)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const updateProduct = async (req, res) => {
  const { name, description, price, categories, colors } = req.body

  try {
    const product = await Product.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    product.name = name || product.name
    product.description = description || product.description
    product.price = price || product.price

    let categoryIds = product.categories

    if (categories) {
      categoryIds = []

      const ids = categories.split(',').map((id) => id.trim())
      categoryIds = ids.filter(isValidObjectId).map((id) => ObjectId.createFromHexString(id))

      if (categoryIds.length === 0) {
        return res.status(400).json({ message: 'Invalid category IDs' })
      }

      const categoriesData = await Category.find({
        _id: { $in: categoryIds },
      })
      if (categoriesData.length !== categoryIds.length) {
        return res.status(400).json({ message: 'Invalid category IDs' })
      }

      product.categories = categoryIds
    }

    if (colors) {
      product.colors = JSON.parse(colors)
    }

    if (req.files) {
      for (const file of req.files) {
        const imageUrl = await uploadToGCS(file, `products/${file.originalname}`)
        product.images.push(imageUrl)
      }
    }

    const updatedProduct = await product.save()
    res.json(updatedProduct)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    for (const imageUrl of product.images) {
      await deleteFromGCS(imageUrl.split('/').pop())
    }

    await product.remove()
    res.json({ message: 'Product deleted successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const deleteProductImage = async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId)
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    const imageUrl = product.images.find((url) => url.split('/').pop() === req.params.imageId)
    if (!imageUrl) {
      return res.status(404).json({ message: 'Image not found' })
    }

    await deleteFromGCS(req.params.imageId)
    product.images = product.images.filter((url) => url !== imageUrl)
    await product.save()

    res.json({ message: 'Image deleted successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  deleteProductImage,
}
