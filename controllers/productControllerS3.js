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

// const createProduct = async (req, res) => {
//   const schema = Joi.object({
//     name: Joi.string().trim().min(3).max(100).required(),
//     description: Joi.string().trim().min(3).max(500).required(),
//     price: Joi.number().min(0).required(),
//     featured: Joi.boolean(),
//     categories: Joi.string().trim().required(),
//     colors: Joi.string().trim().required(),
//   }).options({ abortEarly: false })

//   const { error } = schema.validate(req.body, { abortEarly: false })
//   if (error) {
//     return res.status(400).json({ message: error.details.map((err) => err.message).join(', ') })
//   }

//   const { name, description, price,featured, categories, colors } = req.body

//   let parsedColors
//   try {
//     parsedColors = JSON.parse(colors)
//   } catch (err) {
//     return res.status(400).json({ message: 'Invalid colors data' })
//   }

//   const colorsSchema = Joi.array()
//     .items(
//       Joi.object({
//         name: Joi.string().trim().required(),
//         image: Joi.string().trim(),
//         sizes: Joi.array()
//           .items(
//             Joi.object({
//               name: Joi.string().trim().required(),
//               quantity: Joi.number().min(0).required(),
//             })
//           )
//           .required(),
//       })
//     )
//     .required()

//   const { error: colorsError } = colorsSchema.validate(parsedColors, { abortEarly: false })
//   if (colorsError) {
//     return res.status(400).json({ message: colorsError.details.map((err) => err.message).join(', ') })
//   }

//   try {
//     let categoryIds = []

//     const ids = categories.split(',').map((id) => id.trim())
//     categoryIds = ids.filter(isValidObjectId).map((id) => ObjectId.createFromHexString(id))

//     if (categoryIds.length === 0) {
//       return res.status(400).json({ message: 'Invalid category IDs' })
//     }

//     const categoriesData = await Category.find({
//       _id: { $in: categoryIds },
//     })
//     if (categoriesData.length !== categoryIds.length) {
//       return res.status(400).json({ message: 'Invalid category IDs' })
//     }

//     function generateSKU() {
//       const prefix = 'RAVEEDA-'
//       const randomPart = Math.random().toString(36).substring(2, 10)
//       return prefix + randomPart.toLocaleUpperCase()
//     }

//     const sku = generateSKU()

//     // Process product images
//     const productImages = []
//     if (req.files) {
//       for (const image of req.files) {
//         const processedImage = await processAndUploadImage(image)
//         productImages.push(processedImage)
//       }
//     }

//     // Process color images
//     const processedColors = await Promise.all(
//       parsedColors.map(async (color) => {
//         if (color.image) {
//           const image = req.files.find((f) => f.originalname === color.image)
//           if (image) {
//             const processedImage = await processAndUploadImage(image, 'products/colors')
//             return {
//               ...color,
//               image: processedImage,
//             }
//           }
//         }
//         return color
//       })
//     )

//     const product = await Product.create({
//       name,
//       description,
//       price,
//       featured,
//       categories: categoryIds,
//       sku,
//       images: productImages,
//       colors: processedColors,
//     })

//     const createdProduct = await Product.findById(product._id).populate('categories', 'name _id').lean()

//     res.status(201).json({ message: 'Product created successfully', data: createdProduct })
//   } catch (error) {
//     res.status(500).json({ message: 'Server error', error: error.message })
//   }
// }

// const updateProduct = async (req, res) => {
//   const schema = Joi.object({
//     name: Joi.string().trim().min(3).max(100),
//     description: Joi.string().trim().min(3).max(500),
//     price: Joi.number().min(0),
//     featured: Joi.boolean(),
//     categories: Joi.string().trim(),
//     colors: Joi.string().trim(),
//   }).options({ abortEarly: false })

//   const { error } = schema.validate(req.body, { abortEarly: false })
//   if (error) {
//     return res.status(400).json({ message: error.details.map((err) => err.message).join(', ') })
//   }

//   const { name, description, price, featured, categories, colors } = req.body

//   let parsedColors
//   try {
//     parsedColors = colors ? JSON.parse(colors) : undefined
//   } catch (err) {
//     return res.status(400).json({ message: 'Invalid colors data' })
//   }

//   try {
//     const product = await Product.findById(req.params.id)
//     if (!product) {
//       return res.status(404).json({ message: 'Product not found' })
//     }

//     if (name) product.name = name
//     if (description) product.description = description
//     if (price) product.price = price
//     if (featured) product.featured = featured

//     if (categories) {
//       const ids = categories.split(',').map((id) => id.trim())
//       const categoryIds = ids.filter(isValidObjectId).map((id) => ObjectId.createFromHexString(id))

//       if (categoryIds.length === 0) {
//         return res.status(400).json({ message: 'Invalid category IDs' })
//       }

//       const categoriesData = await Category.find({
//         _id: { $in: categoryIds },
//       })
//       if (categoriesData.length !== categoryIds.length) {
//         return res.status(400).json({ message: 'Invalid category IDs' })
//       }

//       product.categories = categoryIds
//     }

//     if (colors) {
//       product.colors = parsedColors
//     }

//     if (req.files && req.files.length > 0) {
//       for (const image of req.files) {
//         const processedImage = await processAndUploadImage(image)
//         product.images.push(processedImage)
//       }
//     }

//     await product.save()

//     const updatedProduct = await Product.findById(product._id).populate('categories', 'name _id').lean()

//     res.status(200).json({ data: updatedProduct, message: 'Product updated successfully' })
//   } catch (error) {
//     res.status(500).json({ message: 'Server error', error: error.message })
//   }
// }

const createProduct = async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().trim().min(3).max(100).required(),
    description: Joi.string().trim().min(3).max(500).required(),
    price: Joi.number().min(0).required(),
    featured: Joi.boolean(),
    categories: Joi.string().trim().required(),
    colors: Joi.string().trim().required(),
    stockDetails: Joi.string().trim().allow(''),
    supplier: Joi.string().trim().allow(''),
  }).options({ abortEarly: false })

  const { error } = schema.validate(req.body, { abortEarly: false })
  if (error) {
    return res.status(400).json({ message: error.details.map((err) => err.message).join(', ') })
  }

  const { name, description, price, featured, categories, colors, stockDetails, supplier } = req.body

  let parsedColors
  try {
    parsedColors = JSON.parse(colors)
  } catch (err) {
    return res.status(400).json({ message: 'Invalid colors data' })
  }

  // Enhanced schema for colors that includes purchase cost
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
              purchaseCost: Joi.number().min(0).default(0),
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

        // Add stock history for each size
        const processedSizes = color.sizes.map((size) => ({
          ...size,
          history: [
            {
              date: new Date(),
              previousQuantity: 0,
              newQuantity: size.quantity,
              change: size.quantity,
              reason: 'initial',
              note: 'Initial inventory',
            },
          ],
        }))

        return {
          ...color,
          sizes: processedSizes,
        }
      })
    )

    const lastRestockDate = new Date()

    const product = await Product.create({
      name,
      description,
      price,
      featured,
      categories: categoryIds,
      sku,
      images: productImages,
      colors: processedColors,
      stockDetails: stockDetails || '',
      supplier: supplier || '',
      lastRestockDate,
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
    stockDetails: Joi.string().trim().allow(''),
    supplier: Joi.string().trim().allow(''),
    updateStock: Joi.boolean().default(false),
  }).options({ abortEarly: false })

  const { error } = schema.validate(req.body, { abortEarly: false })
  if (error) {
    return res.status(400).json({ message: error.details.map((err) => err.message).join(', ') })
  }

  const { name, description, price, featured, categories, colors, stockDetails, supplier, updateStock } = req.body

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
    if (featured !== undefined) product.featured = featured
    if (stockDetails !== undefined) product.stockDetails = stockDetails
    if (supplier !== undefined) product.supplier = supplier

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

    if (colors && updateStock) {
      // Track old quantities to generate history entries
      const oldColorsMap = new Map()
      product.colors.forEach((color) => {
        const sizeMap = new Map()
        color.sizes.forEach((size) => {
          sizeMap.set(size.name, {
            quantity: size.quantity,
            purchaseCost: size.purchaseCost,
            history: size.history || [],
          })
        })
        oldColorsMap.set(color.name, sizeMap)
      })

      // Update colors and sizes with history entries
      parsedColors.forEach((newColor) => {
        const colorIndex = product.colors.findIndex((c) => c.name === newColor.name)

        if (colorIndex >= 0) {
          // Color exists, update its sizes
          newColor.sizes.forEach((newSize) => {
            const sizeIndex = product.colors[colorIndex].sizes.findIndex((s) => s.name === newSize.name)

            if (sizeIndex >= 0) {
              // Size exists, update quantity and add history if changed
              const oldSize = product.colors[colorIndex].sizes[sizeIndex]
              const oldQuantity = oldSize.quantity
              const newQuantity = newSize.quantity

              if (oldQuantity !== newQuantity) {
                const change = newQuantity - oldQuantity
                // Create history entry for the change
                const historyEntry = {
                  date: new Date(),
                  previousQuantity: oldQuantity,
                  newQuantity: newQuantity,
                  change: change,
                  reason: change > 0 ? 'restock' : 'adjustment',
                  note: 'Inventory update by admin',
                }

                product.colors[colorIndex].sizes[sizeIndex].history.push(historyEntry)
                product.colors[colorIndex].sizes[sizeIndex].quantity = newQuantity
              }

              // Update purchase cost if provided
              if (newSize.purchaseCost !== undefined) {
                product.colors[colorIndex].sizes[sizeIndex].purchaseCost = newSize.purchaseCost
              }
            } else {
              // Size doesn't exist, add it with initial history
              const historyEntry = {
                date: new Date(),
                previousQuantity: 0,
                newQuantity: newSize.quantity,
                change: newSize.quantity,
                reason: 'initial',
                note: 'New size added',
              }

              product.colors[colorIndex].sizes.push({
                name: newSize.name,
                quantity: newSize.quantity,
                purchaseCost: newSize.purchaseCost || 0,
                history: [historyEntry],
              })
            }
          })
        } else {
          // New color, add with initial history for all sizes
          const sizesWithHistory = newColor.sizes.map((size) => ({
            name: size.name,
            quantity: size.quantity,
            purchaseCost: size.purchaseCost || 0,
            history: [
              {
                date: new Date(),
                previousQuantity: 0,
                newQuantity: size.quantity,
                change: size.quantity,
                reason: 'initial',
                note: 'New color/size added',
              },
            ],
          }))

          product.colors.push({
            name: newColor.name,
            image: newColor.image || {},
            sizes: sizesWithHistory,
          })
        }
      })

      // If this was a restock, update the lastRestockDate
      const hadRestock = parsedColors.some((color) =>
        color.sizes.some((size) => {
          const oldSize = oldColorsMap.get(color.name)?.get(size.name)
          return oldSize && size.quantity > oldSize.quantity
        })
      )

      if (hadRestock) {
        product.lastRestockDate = new Date()
      }
    } else if (colors) {
      // Just update the colors data without tracking history
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

// Get current stock levels for all products or filtered by category
const getCurrentStock = async (req, res) => {
  try {
    const { category, lowStock = false, page = 1, limit = 50 } = req.query
    const query = {}
    
    if (category) {
      query.categories = category
    }
    
    const products = await Product.find(query)
      .populate('categories', 'name')
      .select('name sku colors totalInventoryCost lastRestockDate')
      .sort({ 'name': 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean()
    
    // Transform data to be more admin-friendly
    const stockData = products.map(product => {
      const totalQuantity = product.colors.reduce((colorTotal, color) => {
        return colorTotal + color.sizes.reduce((sizeTotal, size) => {
          return sizeTotal + size.quantity
        }, 0)
      }, 0)
      
      const lowStockSizes = []
      
      // Identify low stock items (less than 5 items)
      product.colors.forEach(color => {
        color.sizes.forEach(size => {
          if (size.quantity < 5) {
            lowStockSizes.push({
              color: color.name,
              size: size.name,
              quantity: size.quantity
            })
          }
        })
      })
      
      // Filter out products with sufficient stock if lowStock filter is applied
      if (lowStock && lowStockSizes.length === 0) {
        return null
      }
      
      return {
        id: product._id,
        name: product.name,
        sku: product.sku,
        categories: product.categories,
        totalQuantity,
        lowStockSizes,
        totalInventoryCost: product.totalInventoryCost,
        lastRestockDate: product.lastRestockDate
      }
    }).filter(Boolean) // Remove null entries (filtered out by lowStock)
    
    const totalCount = await Product.countDocuments(query)
    
    res.status(200).json({
      message: 'Current stock data retrieved successfully',
      data: {
        products: stockData,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: parseInt(page),
        totalProducts: totalCount
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// Get detailed inventory monthly summary
const getInventorySummary = async (req, res) => {
  try {
    const { month, year, categoryId } = req.query
    
    if (!month || !year) {
      return res.status(400).json({ message: 'Month and year are required' })
    }
    
    // Convert month and year to Date objects for the start and end of the month
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1)
    const endDate = new Date(parseInt(year), parseInt(month), 0) // Last day of the month
    endDate.setHours(23, 59, 59, 999)
    
    // Build query based on filters
    const query = {}
    if (categoryId) {
      query.categories = categoryId
    }
    
    // Get all products that match the category filter
    const products = await Product.find(query)
      .populate('categories', 'name')
      .lean()
    
    // Process the inventory history for the specified month
    const inventorySummary = []
    
    products.forEach(product => {
      const productSummary = {
        id: product._id,
        name: product.name,
        sku: product.sku,
        categories: product.categories,
        initialStock: 0,
        finalStock: 0,
        sold: 0,
        restocked: 0,
        returned: 0,
        adjustments: 0,
        colorSizes: [],
        dailyStockHistory: {}
      }
      
      // Get stock movements by color and size
      product.colors.forEach(color => {
        color.sizes.forEach(size => {
          const colorSizeSummary = {
            color: color.name,
            size: size.name,
            initialStock: 0,
            finalStock: size.quantity,
            sold: 0,
            restocked: 0,
            returned: 0,
            adjustments: 0,
            dailyHistory: {}
          }
          
          // Filter history entries for the specified month
          const monthHistory = size.history?.filter(entry => {
            const entryDate = new Date(entry.date)
            return entryDate >= startDate && entryDate <= endDate
          }) || []
          
          // If no history for this month, get the latest entry before this month
          if (monthHistory.length === 0) {
            // We only include current quantity in the summary
            colorSizeSummary.initialStock = size.quantity
            productSummary.initialStock += size.quantity
          } else {
            // Process each history entry for this month
            monthHistory.forEach(entry => {
              const entryDate = new Date(entry.date)
              const dayKey = entryDate.getDate().toString()
              
              // Initialize the day in history if needed
              if (!colorSizeSummary.dailyHistory[dayKey]) {
                colorSizeSummary.dailyHistory[dayKey] = {
                  date: entryDate,
                  quantity: entry.previousQuantity,
                  changes: []
                }
              }
              
              // Add the change to the day's history
              colorSizeSummary.dailyHistory[dayKey].changes.push({
                change: entry.change,
                reason: entry.reason,
                newQuantity: entry.newQuantity
              })
              
              // Update final quantity for the day
              colorSizeSummary.dailyHistory[dayKey].quantity = entry.newQuantity
              
              // Also update the product's daily history
              if (!productSummary.dailyStockHistory[dayKey]) {
                productSummary.dailyStockHistory[dayKey] = {
                  date: entryDate,
                  changes: {}
                }
              }
              
              // Initialize or increment change counts for this reason
              if (!productSummary.dailyStockHistory[dayKey].changes[entry.reason]) {
                productSummary.dailyStockHistory[dayKey].changes[entry.reason] = 0
              }
              productSummary.dailyStockHistory[dayKey].changes[entry.reason] += entry.change
              
              // Track changes by reason
              switch(entry.reason) {
                case 'sale':
                  colorSizeSummary.sold -= entry.change // change will be negative
                  productSummary.sold -= entry.change
                  break
                case 'restock':
                  colorSizeSummary.restocked += entry.change
                  productSummary.restocked += entry.change
                  break
                case 'return':
                  colorSizeSummary.returned += entry.change
                  productSummary.returned += entry.change
                  break
                case 'adjustment':
                  colorSizeSummary.adjustments += entry.change
                  productSummary.adjustments += entry.change
                  break
                case 'initial':
                  colorSizeSummary.initialStock = entry.previousQuantity
                  productSummary.initialStock += entry.previousQuantity
                  break
              }
            })
            
            // Set initial stock based on first history entry of the month
            if (monthHistory.length > 0) {
              const firstEntry = monthHistory.sort((a, b) => new Date(a.date) - new Date(b.date))[0]
              colorSizeSummary.initialStock = firstEntry.previousQuantity
            }
          }
          
          productSummary.colorSizes.push(colorSizeSummary)
          productSummary.finalStock += colorSizeSummary.finalStock
        })
      })
      
      inventorySummary.push(productSummary)
    })
    
    // Calculate overall summary statistics
    const overallSummary = {
      totalProducts: inventorySummary.length,
      totalInitialStock: inventorySummary.reduce((sum, product) => sum + product.initialStock, 0),
      totalFinalStock: inventorySummary.reduce((sum, product) => sum + product.finalStock, 0),
      totalSold: inventorySummary.reduce((sum, product) => sum + product.sold, 0),
      totalRestocked: inventorySummary.reduce((sum, product) => sum + product.restocked, 0),
      totalReturned: inventorySummary.reduce((sum, product) => sum + product.returned, 0),
      totalAdjustments: inventorySummary.reduce((sum, product) => sum + product.adjustments, 0),
      totalInventoryCost: inventorySummary.reduce((sum, product) => sum + (product.totalInventoryCost || 0), 0),
      monthStartDate: startDate,
      monthEndDate: endDate
    }
    
    res.status(200).json({
      message: 'Inventory summary generated successfully',
      data: {
        overallSummary,
        productsSummary: inventorySummary
      }
    })
  } catch (error) {
    console.error('Error in getInventorySummary:', error)
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// Track stock changes when orders are created
const updateStockFromOrder = async (orderId, items, operationType = 'decrease') => {
  try {
    for (const item of items) {
      const product = await Product.findById(item.productId)
      
      if (!product) {
        console.error(`Product not found: ${item.productId}`)
        continue
      }
      
      const colorIndex = product.colors.findIndex(c => c.name === item.color)
      if (colorIndex === -1) {
        console.error(`Color not found: ${item.color} in product ${product.name}`)
        continue
      }
      
      const sizeIndex = product.colors[colorIndex].sizes.findIndex(s => s.name === item.size)
      if (sizeIndex === -1) {
        console.error(`Size not found: ${item.size} in product ${product.name}, color ${item.color}`)
        continue
      }
      
      const size = product.colors[colorIndex].sizes[sizeIndex]
      const previousQuantity = size.quantity
      
      // Decrease or increase quantity based on operation type
      const change = operationType === 'decrease' ? -item.quantity : item.quantity
      const newQuantity = previousQuantity + change
      
      // Update quantity
      product.colors[colorIndex].sizes[sizeIndex].quantity = newQuantity
      
      // Add to history
      const historyEntry = {
        date: new Date(),
        previousQuantity,
        newQuantity,
        change,
        reason: operationType === 'decrease' ? 'sale' : 'return',
        orderId,
        note: `Order ID: ${orderId}`
      }
      
      product.colors[colorIndex].sizes[sizeIndex].history.push(historyEntry)
      
      await product.save()
    }
    
    return true
  } catch (error) {
    console.error('Error updating stock from order:', error)
    return false
  }
}

// Add a specific restock function for admin use
const restockProduct = async (req, res) => {
  const schema = Joi.object({
    colorName: Joi.string().required(),
    sizeName: Joi.string().required(),
    quantity: Joi.number().integer().min(1).required(),
    purchaseCost: Joi.number().min(0),
    note: Joi.string().allow(''),
  }).options({ abortEarly: false })

  const { error } = schema.validate(req.body, { abortEarly: false })
  if (error) {
    return res.status(400).json({ message: error.details.map((err) => err.message).join(', ') })
  }

  const { colorName, sizeName, quantity, purchaseCost, note } = req.body
  
  try {
    const product = await Product.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }
    
    const colorIndex = product.colors.findIndex(c => c.name === colorName)
    if (colorIndex === -1) {
      return res.status(404).json({ message: `Color ${colorName} not found` })
    }
    
    const sizeIndex = product.colors[colorIndex].sizes.findIndex(s => s.name === sizeName)
    if (sizeIndex === -1) {
      return res.status(404).json({ message: `Size ${sizeName} not found for color ${colorName}` })
    }
    
    const size = product.colors[colorIndex].sizes[sizeIndex]
    const previousQuantity = size.quantity
    const newQuantity = previousQuantity + quantity
    
    // Update quantity
    product.colors[colorIndex].sizes[sizeIndex].quantity = newQuantity
    
    // Update purchase cost if provided
    if (purchaseCost !== undefined) {
      product.colors[colorIndex].sizes[sizeIndex].purchaseCost = purchaseCost
    }
    
    // Add history entry
    const historyEntry = {
      date: new Date(),
      previousQuantity,
      newQuantity,
      change: quantity,
      reason: 'restock',
      note: note || 'Product restocked by admin'
    }
    
    product.colors[colorIndex].sizes[sizeIndex].history.push(historyEntry)
    
    // Update lastRestockDate
    product.lastRestockDate = new Date()
    
    await product.save()
    
    res.status(200).json({
      message: 'Product restocked successfully',
      data: {
        productId: product._id,
        colorName,
        sizeName,
        previousQuantity,
        newQuantity,
        added: quantity,
        currentTotalInventoryCost: product.totalInventoryCost
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// Get stock history for a specific product
const getProductStockHistory = async (req, res) => {
  try {
    const { id } = req.params
    const { startDate, endDate } = req.query
    
    const product = await Product.findById(id)
      .populate('categories', 'name')
      .lean()
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }
    
    let query = {}
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    }
    
    // Format the history data
    const historyData = {
      productId: product._id,
      name: product.name,
      sku: product.sku,
      colorSizes: []
    }
    
    product.colors.forEach(color => {
      color.sizes.forEach(size => {
        const sizeHistory = {
          colorName: color.name,
          sizeName: size.name,
          currentQuantity: size.quantity,
          purchaseCost: size.purchaseCost,
          history: []
        }
        
        // Filter history by date if needed
        if (size.history) {
          sizeHistory.history = size.history
            .filter(entry => {
              if (!startDate || !endDate) return true
              
              const entryDate = new Date(entry.date)
              return entryDate >= new Date(startDate) && entryDate <= new Date(endDate)
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date)) // Most recent first
        }
        
        historyData.colorSizes.push(sizeHistory)
      })
    })
    
    res.status(200).json({
      message: 'Product stock history retrieved successfully',
      data: historyData
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
  getCurrentStock,
  getInventorySummary,
  updateStockFromOrder,
  restockProduct,
  getProductStockHistory,
}
