const express = require('express')
const router = express.Router()
const { getProducts, getProductById, createProduct, updateProduct, deleteProduct, deleteProductImage } = require('../controllers/productController')
const multer = require('multer')
const upload = multer({ storage: multer.memoryStorage() })

router.route('/').get(getProducts).post(upload.array('images'), createProduct)
router.route('/:id').get(getProductById).put(upload.array('images'), updateProduct).delete(deleteProduct)
router.route('/:productId/images/:imageId').delete(deleteProductImage)

module.exports = router
