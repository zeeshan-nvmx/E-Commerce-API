const express = require('express')
const router = express.Router()
const { getProducts, getProductById, createProduct, updateProduct, deleteProduct, deleteProductImage, addProductImage } = require('../controllers/productController')
const multer = require('multer')
const authorizeRoles = require('../middleware/roleAuthorization')
const auth = require('../middleware/auth')
const upload = multer({ storage: multer.memoryStorage() })

router.route('/').get(getProducts).post(auth, authorizeRoles('admin','superadmin'), upload.array('images'), createProduct)
router.route('/:id').get(getProductById).put(auth, authorizeRoles('admin','superadmin'), upload.array('images'), updateProduct).delete(auth, authorizeRoles('admin','superadmin'), deleteProduct)
router.route('/images/:productId').delete(auth, authorizeRoles('admin','superadmin'), deleteProductImage)

module.exports = router
