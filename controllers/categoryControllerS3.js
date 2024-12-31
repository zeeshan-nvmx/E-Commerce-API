const Category = require('../models/Category')
const Product = require('../models/Product')
const { uploadToS3, deleteFromS3 } = require('../utils/s3')
const Joi = require('joi')
const sharp = require('sharp')
const { ObjectId, isValidObjectId } = require('mongoose').Types

//Image processing helper function ( only for category )
const processAndUploadImage = async (imageFile, pathPrefix = 'categories') => {
  try {
    
    const thumbnailBuffer = await sharp(imageFile.buffer)
      .resize(400, 400, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toBuffer()

    // Remove spaces from the original image name
    const sanitizedOriginalName = imageFile.originalname.replace(/\s+/g, '')
    const timestamp = Date.now()

    // Upload original image
    const image = await uploadToS3(imageFile, `${pathPrefix}/${timestamp}_${sanitizedOriginalName}`)

    // Upload thumbnail
    const thumbnail = await uploadToS3({ ...imageFile, buffer: thumbnailBuffer }, `${pathPrefix}/thumbnails/${timestamp}_thumb_${sanitizedOriginalName}`)

    return {
      image,
      thumbnail,
    }
  } catch (error) {
    console.error('Error in processAndUploadImage:', error)
    throw error
  }
}
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().lean()

    const formattedCategories = categories.map((category) => {
      const formattedCategory = {
        ...category,
        subcategories: [],
      }

      if (!category.isSubcategory) {
        const subcategories = categories.filter((c) => c.parentCategory && c.parentCategory.toString() === category._id.toString())
        formattedCategory.subcategories = subcategories.map((subcategory) => ({
          id: subcategory._id,
          name: subcategory.name,
        }))
      }

      return formattedCategory
    })

    res.status(200).json({ message: 'Categories fetched successfully', data: formattedCategories })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).lean()
    if (!category) {
      return res.status(404).json({ message: 'Category not found' })
    }

    const formattedCategory = {
      ...category,
      subcategories: [],
    }

    if (!category.isSubcategory) {
      const subcategories = await Category.find({ parentCategory: category._id }).select('name _id').lean()
      formattedCategory.subcategories = subcategories.map((subcategory) => ({
        id: subcategory._id,
        name: subcategory.name,
      }))
    }

    res.status(200).json({ message: 'Category fetched successfully', data: formattedCategory })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const updateCategory = async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().trim().min(3),
    description: Joi.string().trim().min(3),
    isSubcategory: Joi.boolean(),
    parentCategoryId: Joi.string().trim().length(24).when('isSubcategory', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
  })

  const { error } = schema.validate(req.body)
  if (error) {
    return res.status(400).json({ message: error.details[0].message })
  }

  const { name, description, isSubcategory, parentCategoryId } = req.body
  try {
    const category = await Category.findById(req.params.id)
    if (!category) {
      return res.status(404).json({ message: 'Category not found' })
    }

    if (name) category.name = name
    if (description) category.description = description
    if (isSubcategory !== undefined) category.isSubcategory = isSubcategory
    if (isSubcategory && parentCategoryId) category.parentCategory = parentCategoryId

    // Only handle image updates if a new file is provided
    if (req.file) {
      try {
        // Delete existing images if they exist
        if (category.image) {
          await deleteFromS3(category.image.split('/').pop())
        }
        if (category.thumbnail) {
          await deleteFromS3(category.thumbnail.split('/').pop())
        }

        // Process and upload new image
        const result = await processAndUploadImage(req.file)
        console.log('Processed image result:', result) // Debug log

        // Update category with new image URLs
        category.image = result.image
        category.thumbnail = result.thumbnail
      } catch (error) {
        console.error('Error processing image:', error)
        return res.status(500).json({ message: 'Error processing image', error: error.message })
      }
    }

    const updatedCategory = await category.save()
    console.log('Updated category:', updatedCategory) // Debug log
    res.json(updatedCategory)
  } catch (error) {
    console.error('Error in updateCategory:', error)
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const createCategory = async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().trim().min(3).required(),
    description: Joi.string().trim().min(3),
    isSubcategory: Joi.boolean(),
    parentCategoryId: Joi.string().trim().length(24).when('isSubcategory', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
  })

  const { error } = schema.validate(req.body)
  if (error) {
    return res.status(400).json({ message: error.details[0].message })
  }

  const { name, description, isSubcategory, parentCategoryId } = req.body
  try {
    const categoryExists = await Category.findOne({ name })
    if (categoryExists) {
      return res.status(400).json({ message: 'Category already exists' })
    }

    let image = ''
    let thumbnail = ''

    if (req.file) {
      try {
        const result = await processAndUploadImage(req.file)
        console.log('Processed image result:', result) // Debug log
        image = result.image
        thumbnail = result.thumbnail
      } catch (error) {
        console.error('Error processing image:', error)
        return res.status(500).json({ message: 'Error processing image', error: error.message })
      }
    }

    const category = await Category.create({
      name,
      description,
      image,
      thumbnail,
      isSubcategory: isSubcategory || false,
      parentCategory: isSubcategory ? parentCategoryId : null,
    })

    res.status(201).json({ message: 'Category created successfully', data: category })
  } catch (error) {
    console.error('Error in createCategory:', error)
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
    if (!category) {
      return res.status(404).json({ message: 'Category not found' })
    }

    // Delete both original and thumbnail images from S3 if they exist
    if (category.image) {
      try {
        await deleteFromS3(category.image.split('/').pop())
      } catch (error) {
        console.error('Error deleting category image from S3:', error)
      }
    }
    if (category.thumbnail) {
      try {
        await deleteFromS3(category.thumbnail.split('/').pop())
      } catch (error) {
        console.error('Error deleting category thumbnail from S3:', error)
      }
    }

    // Find all products associated with this category
    const productsToDelete = await Product.find({ categories: category._id })

    // Delete all associated products
    for (const product of productsToDelete) {
      // Delete product images from S3
      for (const image of product.images) {
        try {
          await deleteFromS3(image?.split('/').pop())
        } catch (error) {
          console.error('Error deleting product image from S3:', error)
        }
      }

      // Delete the single product
      await Product.deleteOne({ _id: product._id })
    }

    // Delete the category
    await Category.deleteOne({ _id: category._id })

    res.json({ message: 'Category and associated products deleted successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const getSubcategoriesByCategory = async (req, res) => {
  try {
    const categoryId = req.params.categoryId
    const subcategories = await Category.find({ parentCategory: categoryId })

    res.status(200).json({ message: 'Subcategories fetched successfully', data: subcategories })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getSubcategoriesByCategory,
}
