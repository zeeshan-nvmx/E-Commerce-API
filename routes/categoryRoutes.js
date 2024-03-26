const express = require('express')
const router = express.Router()
const { getCategories, getCategoryById, createCategory, updateCategory, deleteCategory } = require('../controllers/categoryController')
const multer = require('multer')
const upload = multer({ storage: multer.memoryStorage() })

router.route('/').get(getCategories).post(upload.single('image'), createCategory)
router.route('/:id').get(getCategoryById).put(upload.single('image'), updateCategory).delete(deleteCategory)

module.exports = router
