const Product = require('../models/Product')
const Category = require('../models/Category')
const { uploadToS3, deleteFromS3 } = require('../utils/s3')
const { ObjectId } = require('mongodb')
const Joi = require('joi')
const sharp = require('sharp')

const isValidObjectId = (id) => {
  return ObjectId.isValid(id)
}

// Helper function to process image and create thumbnail
const processAndUploadImage = async (image, pathPrefix = 'products') => {
  // Generate thumbnail with maintained aspect ratio
  const thumbnailBuffer = await sharp(image.buffer)
    .resize(400, 400, {
      fit: 'inside', 
      withoutEnlargement: true, 
    })
    .toBuffer()

  // Remove spaces from the original image name
  const sanitizedOriginalName = image.originalname.replace(/\s+/g, '')

  // Upload original image
  const originalImageUrl = await uploadToS3(image, `${pathPrefix}/original/${Date.now()}_${sanitizedOriginalName}`)

  // Upload thumbnail
  const thumbnailImageUrl = await uploadToS3({ ...image, buffer: thumbnailBuffer }, `${pathPrefix}/thumbnails/${Date.now()}_thumb_${sanitizedOriginalName}`)

  return {
    original: originalImageUrl,
    thumbnail: thumbnailImageUrl,
  }
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

    if (search) {
      const searchRegex = new RegExp(search, 'i')
      query.$or = [{ name: searchRegex }, { description: searchRegex }, { sku: searchRegex }]
    }

    const skip = (page - 1) * limit
    const totalProducts = await Product.countDocuments(query)

    const products = await Product.find(query).populate('categories', 'name _id').sort({ createdAt: -1 }).skip(skip).limit(limit).lean()

    const response = {
      data: {
        products,
        totalPages: Math.ceil(totalProducts / limit),
        currentPage: parseInt(page),
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
    const product = await Product.findById(req.params.id).populate('categories', 'name _id').lean()

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
    featured: Joi.boolean(),
    categories: Joi.string().trim().required(),
    colors: Joi.string().trim().required(),
  }).options({ abortEarly: false })

  const { error } = schema.validate(req.body, { abortEarly: false })
  if (error) {
    return res.status(400).json({ message: error.details.map((err) => err.message).join(', ') })
  }

  const { name, description, price,featured, categories, colors } = req.body

  let parsedColors
  try {
    parsedColors = JSON.parse(colors)
  } catch (err) {
    return res.status(400).json({ message: 'Invalid colors data' })
  }

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
      const prefix = 'RAVEEDA-'
      const randomPart = Math.random().toString(36).substring(2, 10)
      return prefix + randomPart.toLocaleUpperCase()
    }

    const sku = generateSKU()

    // Process product images
    const productImages = []
    if (req.files) {
      for (const image of req.files) {
        const processedImage = await processAndUploadImage(image)
        productImages.push(processedImage)
      }
    }

    // Process color images
    const processedColors = await Promise.all(
      parsedColors.map(async (color) => {
        if (color.image) {
          const image = req.files.find((f) => f.originalname === color.image)
          if (image) {
            const processedImage = await processAndUploadImage(image, 'products/colors')
            return {
              ...color,
              image: processedImage,
            }
          }
        }
        return color
      })
    )

    const product = await Product.create({
      name,
      description,
      price,
      featured,
      categories: categoryIds,
      sku,
      images: productImages,
      colors: processedColors,
    })

    const createdProduct = await Product.findById(product._id).populate('categories', 'name _id').lean()

    res.status(201).json({ message: 'Product created successfully', data: createdProduct })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const updateProduct = async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().trim().min(3).max(100),
    description: Joi.string().trim().min(3).max(500),
    price: Joi.number().min(0),
    featured: Joi.boolean(),
    categories: Joi.string().trim(),
    colors: Joi.string().trim(),
  }).options({ abortEarly: false })

  const { error } = schema.validate(req.body, { abortEarly: false })
  if (error) {
    return res.status(400).json({ message: error.details.map((err) => err.message).join(', ') })
  }

  const { name, description, price, featured, categories, colors } = req.body

  let parsedColors
  try {
    parsedColors = colors ? JSON.parse(colors) : undefined
  } catch (err) {
    return res.status(400).json({ message: 'Invalid colors data' })
  }

  try {
    const product = await Product.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    if (name) product.name = name
    if (description) product.description = description
    if (price) product.price = price
    if (featured) product.featured = featured

    if (categories) {
      const ids = categories.split(',').map((id) => id.trim())
      const categoryIds = ids.filter(isValidObjectId).map((id) => ObjectId.createFromHexString(id))

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
      product.colors = parsedColors
    }

    if (req.files && req.files.length > 0) {
      for (const image of req.files) {
        const processedImage = await processAndUploadImage(image)
        product.images.push(processedImage)
      }
    }

    await product.save()

    const updatedProduct = await Product.findById(product._id).populate('categories', 'name _id').lean()

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

    // Delete product images and thumbnails
    for (const imageObj of product.images) {
      try {
        if (imageObj.original) {
          await deleteFromS3(imageObj.original.split('/').pop())
        }
        if (imageObj.thumbnail) {
          await deleteFromS3(imageObj.thumbnail.split('/').pop())
        }
      } catch (error) {
        imagesDeletedSuccessfully = false
        failedImageDeletions.push(imageObj)
      }
    }

    // Delete color images and thumbnails
    for (const color of product.colors) {
      if (color.image) {
        try {
          if (color.image.original) {
            await deleteFromS3(color.image.original.split('/').pop())
          }
          if (color.image.thumbnail) {
            await deleteFromS3(color.image.thumbnail.split('/').pop())
          }
        } catch (error) {
          imagesDeletedSuccessfully = false
          failedImageDeletions.push(color.image)
        }
      }
    }

    await Product.deleteOne({ _id: req.params.id })

    if (imagesDeletedSuccessfully) {
      res.json({ message: 'Product and all associated images deleted successfully' })
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

const deleteProductImage = async (req, res) => {
  const schema = Joi.object({
    imageUrl: Joi.object({
      original: Joi.string().trim().required(),
      thumbnail: Joi.string().trim().required(),
    }).required(),
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

    const imageExists = product.images.some((img) => img.original === imageUrl.original && img.thumbnail === imageUrl.thumbnail)

    if (!imageExists) {
      return res.status(404).json({ message: 'Image not found' })
    }

    try {
      await deleteFromS3(imageUrl.original.split('/').pop())
      await deleteFromS3(imageUrl.thumbnail.split('/').pop())
    } catch (s3Error) {
      console.log('S3 error, continuing to remove from database:', s3Error.message)
    }

    product.images = product.images.filter((img) => img.original !== imageUrl.original || img.thumbnail !== imageUrl.thumbnail)
    await product.save()

    const updatedProduct = await Product.findById(product._id).populate('categories', 'name _id').lean()

    res.json({
      message: 'Image and thumbnail deleted successfully',
      data: updatedProduct,
    })
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
