const Category = require('../models/Category')
const { uploadToS3, deleteFromS3 } = require('../utils/s3')

const getCategories = async (req, res) => {
  try {
    const categories = await Category.find()
    res.status(200).json({ data: categories })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
    if (!category) {
      return res.status(404).json({ message: 'Category not found' })
    }
    res.status(200).json({ data: category })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const createCategory = async (req, res) => {
  const { name, description } = req.body

  try {
    const categoryExists = await Category.findOne({ name })
    if (categoryExists) {
      return res.status(400).json({ message: 'Category already exists' })
    }

    let imageUrl = ''
    if (req.file) {
      imageUrl = await uploadToS3(req.file, `categories/${req.file.originalname}`)
    }

    const category = await Category.create({ name, description, image: imageUrl })
    res.status(201).json({ data: category })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const updateCategory = async (req, res) => {
  const { name, description } = req.body

  try {
    const category = await Category.findById(req.params.id)
    if (!category) {
      return res.status(404).json({ message: 'Category not found' })
    }

    category.name = name || category.name
    category.description = description || category.description

    if (req.file) {
      if (category.image) {
        await deleteFromS3(category.image.split('/').pop())
      }
      const imageUrl = await uploadToS3(req.file, `categories/${req.file.originalname}`)
      category.image = imageUrl
    }

    const updatedCategory = await category.save()
    res.json(updatedCategory)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
    if (!category) {
      return res.status(404).json({ message: 'Category not found' })
    }

    if (category.image) {
      await deleteFromS3(category.image.split('/').pop())
    }

    await category.remove()
    res.json({ message: 'Category deleted successfully' })
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
}
