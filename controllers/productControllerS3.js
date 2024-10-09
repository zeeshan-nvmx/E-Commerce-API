const Product = require('../models/Product')
const Category = require('../models/Category')
const { uploadToS3, deleteFromS3 } = require('../utils/s3')
const { ObjectId } = require('mongodb')
const Joi = require('joi')

const isValidObjectId = (id) => {
  return ObjectId.isValid(id)
}

const getProducts = async (req, res) => {
  try {
    const { categories, colors, sizes, page = 1, limit = 10, search = '' } = req.query
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

    // Partial word matching query
    if (search) {
      const searchRegex = new RegExp(search, 'i')
      query.$or = [{ name: searchRegex }, { description: searchRegex }, { sku: searchRegex }]
    }

    const skip = (page - 1) * limit
    const totalProducts = await Product.countDocuments(query)

    const products = await Product.find(query).populate('categories', 'name _id').skip(skip).limit(limit)

    const response = {
      data: {
        products,
        totalPages: Math.ceil(totalProducts / limit),
        currentPage: page,
        totalProducts,
      },
      message: `Products successfully fetched. Showing page ${page} of ${Math.ceil(totalProducts / limit)} pages.`,
    }

    res.json(response)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('categories', 'name _id')

    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    res.json({ data: product, message: 'Product was successfully fetched' })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const createProduct = async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().trim().min(3).max(100).required(),
    description: Joi.string().trim().min(3).max(500).required(),
    price: Joi.number().min(0).required(),
    categories: Joi.string().trim().required(),
    colors: Joi.string().trim().required(),
  }).options({ abortEarly: false })

  const { error } = schema.validate(req.body, { abortEarly: false })
  if (error) {
    return res.status(400).json({ message: error.details.map((err) => err.message).join(', ') })
  }

  const { name, description, price, categories, colors } = req.body

  // Parse the colors string into an array of objects
  let parsedColors
  try {
    parsedColors = JSON.parse(colors)
  } catch (err) {
    return res.status(400).json({ message: 'Invalid colors data' })
  }

  // Validate the parsed colors array
  const colorsSchema = Joi.array()
    .items(
      Joi.object({
        name: Joi.string().trim().required(),
        image: Joi.string().trim(),
        sizes: Joi.array()
          .items(
            Joi.object({
              name: Joi.string().trim().required(),
              quantity: Joi.number().min(0).required(),
            })
          )
          .required(),
      })
    )
    .required()

  const { error: colorsError } = colorsSchema.validate(parsedColors, { abortEarly: false })
  if (colorsError) {
    return res.status(400).json({ message: colorsError.details.map((err) => err.message).join(', ') })
  }

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

    function generateSKU() {
      const prefix = 'rav '
      const randomPart = Math.random().toString(36).substring(2, 10)
      const sku = prefix + randomPart.toLocaleUpperCase()
      return sku
    }

    const sku = generateSKU()

    const productImages = []
    if (req.files) {
      for (const file of req.files) {
        const imageUrl = await uploadToS3(file, `products/${Date.now() + '_' + file.originalname}`)
        productImages.push(imageUrl)
      }
    }

    const product = await Product.create({
      name,
      description,
      price,
      categories: categoryIds,
      sku,
      images: productImages,
      colors: JSON.parse(colors),
    })
    res.status(201).json({ message: 'Product created successfully', data: product })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const updateProduct = async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().trim().min(3).max(100),
    description: Joi.string().trim().min(3).max(500),
    price: Joi.number().min(0),
    categories: Joi.string().trim(),
    colors: Joi.string().trim(),
  }).options({ abortEarly: false })

  const { error } = schema.validate(req.body, { abortEarly: false })
  if (error) {
    return res.status(400).json({ message: error.details.map((err) => err.message).join(', ') })
  }

  const { name, description, price, categories, colors } = req.body

  // Parse the colors string into an array of objects
  let parsedColors
  try {
    parsedColors = colors ? JSON.parse(colors) : undefined
  } catch (err) {
    return res.status(400).json({ message: 'Invalid colors data' })
  }

  // Validate the parsed colors array (if provided)
  if (parsedColors) {
    const colorsSchema = Joi.array().items(
      Joi.object({
        name: Joi.string().trim(),
        image: Joi.string().trim(),
        sizes: Joi.array().items(
          Joi.object({
            name: Joi.string().trim(),
            quantity: Joi.number().min(0),
          })
        ),
      })
    )

    const { error: colorsError } = colorsSchema.validate(parsedColors, { abortEarly: false })
    if (colorsError) {
      return res.status(400).json({ message: colorsError.details.map((err) => err.message).join(', ') })
    }
  }

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
        const imageUrl = await uploadToS3(file, `products/${Date.now() + '_' + file.originalname}`)
        product.images.push(imageUrl)
      }
    }

    const updatedProduct = await product.save()
    res.status(200).json({ data: updatedProduct, message: 'Product updated successfully' })
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

    let imagesDeletedSuccessfully = true
    const failedImageDeletions = []

    // Delete images from S3
    for (const imageUrl of product.images) {
      try {
        await deleteFromS3(imageUrl.split('/').pop())
      } catch (error) {
        imagesDeletedSuccessfully = false
        failedImageDeletions.push(imageUrl)
      }
    }

    // Delete the product document
    await Product.deleteOne({ _id: req.params.id })

    if (imagesDeletedSuccessfully) {
      res.json({ message: 'Product deleted successfully' })
    } else {
      res.json({
        message: 'Product deleted successfully, but some images could not be deleted',
        failedImageDeletions,
      })
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// const deleteProductImage = async (req, res) => {
//   const schema = Joi.object({
//     imageUrl: Joi.string().trim().required(),
//   }).options({ abortEarly: false })

//   const { error } = schema.validate(req.body, { abortEarly: false })
//   if (error) {
//     return res.status(400).json({ message: error.details.map((err) => err.message).join(', ') })
//   }

//   const { imageUrl } = req.body

//   try {
//     const product = await Product.findById(req.params.productId)
//     if (!product) {
//       return res.status(404).json({ message: 'Product not found' })
//     }

//     if (!product.images.includes(imageUrl)) {
//       return res.status(404).json({ message: 'Image not found' })
//     }

//     await deleteFromS3(imageUrl.split('/').pop())
//     product.images = product.images.filter((url) => url !== imageUrl)
//     await product.save()

//     res.json({ message: 'Image deleted successfully' })
//   } catch (error) {
//     res.status(500).json({ message: 'Server error', error: error.message })
//   }
// }

const deleteProductImage = async (req, res) => {
  const schema = Joi.object({
    imageUrl: Joi.string().trim().required(),
  }).options({ abortEarly: false })

  const { error } = schema.validate(req.body, { abortEarly: false })
  if (error) {
    return res.status(400).json({ message: error.details.map((err) => err.message).join(', ') })
  }

  const { imageUrl } = req.body

  try {
    const product = await Product.findById(req.params.productId)
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    if (!product.images.includes(imageUrl)) {
      return res.status(404).json({ message: 'Image not found' })
    }

    // Try to delete from S3
    try {
      await deleteFromS3(imageUrl.split('/').pop())
    } catch (s3Error) {
      // Log or handle S3 error but proceed with the image URL deletion
      console.log('S3 error, continuing to remove from database:', s3Error.message)
    }

    // Remove the image URL from the database even if the S3 deletion fails
    product.images = product.images.filter((url) => url !== imageUrl)
    await product.save()

    res.json({ message: 'Image deleted successfully from database' })
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
