const Category = require('../models/Category')
const Product = require('../models/Product')
const { uploadToLocal, deleteFromLocal } = require('../utils/local-storage')
const Joi = require('joi')
const path = require('path')

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
    name: Joi.string().trim().min(3).max(50),
    description: Joi.string().trim().min(3).max(500),
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

    category.name = name || category.name
    category.description = description || category.description
    category.isSubcategory = isSubcategory !== undefined ? isSubcategory : category.isSubcategory
    category.parentCategory = isSubcategory && parentCategoryId ? parentCategoryId : category.parentCategory

    if (req.file) {
      if (category.image) {
        await deleteFromLocal(path.basename(category.image))
      }
      const fileName = `${Date.now()}_${req.file.originalname}`
      const imagePath = await uploadToLocal(req.file, fileName)
      category.image = imagePath
    }

    const updatedCategory = await category.save()
    res.json(updatedCategory)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const createCategory = async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().trim().min(3).max(50).required(),
    description: Joi.string().trim().min(3).max(500),
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

    let imagePath = ''
    if (req.file) {
      const fileName = `${Date.now()}_${req.file.originalname}`
      imagePath = await uploadToLocal(req.file, fileName)
    }

    const category = await Category.create({
      name,
      description,
      image: imagePath,
      isSubcategory: isSubcategory || false,
      parentCategory: isSubcategory ? parentCategoryId : null,
    })

    res.status(201).json({ message: 'Category created successfully', data: category })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// const deleteCategory = async (req, res) => {
//   try {
//     const category = await Category.findById(req.params.id)
//     if (!category) {
//       return res.status(404).json({ message: 'Category not found' })
//     }

//     if (category.image) {
//       try {
//         await deleteFromLocal(path.basename(category.image))
//       } catch (error) {
//         console.error('Error deleting image:', error)
//       }
//     }

//     await Category.deleteOne({ _id: category._id })
//     res.json({ message: 'Category deleted successfully' })
//   } catch (error) {
//     res.status(500).json({ message: 'Server error', error: error.message })
//   }
// }

const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
    if (!category) {
      return res.status(404).json({ message: 'Category not found' })
    }

    // Delete the category image if it exists
    if (category.image) {
      try {
        await deleteFromLocal(path.basename(category.image))
      } catch (error) {
        console.error('Error deleting image:', error)
      }
    }

    // Find all products associated with this category
    const productsToDelete = await Product.find({ categories: category._id })

    // Delete all associated products
    for (const product of productsToDelete) {
      // Delete product images
      for (const image of product.images) {
        try {
          await deleteFromLocal(path.basename(image))
        } catch (error) {
          console.error('Error deleting product image:', error)
        }
      }

      // Delete color images
      for (const color of product.colors) {
        if (color.image) {
          try {
            await deleteFromLocal(path.basename(color.image))
          } catch (error) {
            console.error('Error deleting color image:', error)
          }
        }
      }

      // Delete the product
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
