const express = require('express')
const router = express.Router()
const { getCategories, getCategoryById, createCategory, updateCategory, deleteCategory } = require('../controllers/categoryControllerLocal')
const multer = require('multer')
const authorizeRoles = require('../middleware/roleAuthorization')
const auth = require('../middleware/auth')
const upload = multer({ storage: multer.memoryStorage() })

router.route('/').get(getCategories).post(auth, authorizeRoles('admin','superadmin'), upload.single('image'), createCategory)
router
  .route('/:id')
  .get(getCategoryById)
  .put(auth, authorizeRoles('admin', 'superadmin'), upload.single('image'), updateCategory)
  .delete(auth, authorizeRoles('admin', 'superadmin'), deleteCategory)

module.exports = router
