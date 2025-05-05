// routes/productRoutes.js (updated)
const express = require('express')
const router = express.Router()
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  deleteProductImage,
  getCurrentStock,
  getInventorySummary,
  restockProduct,
  getProductStockHistory,
} = require('../controllers/productControllerS3')
const multer = require('multer')
const authorizeRoles = require('../middleware/roleAuthorization')
const auth = require('../middleware/auth')
const upload = multer({ storage: multer.memoryStorage() })

// Public routes
router.route('/').get(getProducts)
router.route('/:id').get(getProductById)

// Admin-only routes
router.route('/').post(auth, authorizeRoles('admin', 'superadmin'), upload.array('images'), createProduct)
router.route('/:id').put(auth, authorizeRoles('admin', 'superadmin'), upload.array('images'), updateProduct)
router.route('/:id').delete(auth, authorizeRoles('admin', 'superadmin'), deleteProduct)
router.route('/images/:productId').delete(auth, authorizeRoles('admin', 'superadmin'), deleteProductImage)

// New admin inventory management routes
router.route('/inventory/stock').get(auth, authorizeRoles('admin', 'superadmin'), getCurrentStock)
router.route('/inventory/summary').get(auth, authorizeRoles('admin', 'superadmin'), getInventorySummary)
router.route('/inventory/:id/restock').post(auth, authorizeRoles('admin', 'superadmin'), restockProduct)
router.route('/inventory/:id/history').get(auth, authorizeRoles('admin', 'superadmin'), getProductStockHistory)

module.exports = router

// const express = require('express')
// const router = express.Router()
// const { getProducts, getProductById, createProduct, updateProduct, deleteProduct, deleteProductImage, addProductImage } = require('../controllers/productControllerS3')
// const multer = require('multer')
// const authorizeRoles = require('../middleware/roleAuthorization')
// const auth = require('../middleware/auth')
// const upload = multer({ storage: multer.memoryStorage() })

// router.route('/').get(getProducts).post(auth, authorizeRoles('admin','superadmin'), upload.array('images'), createProduct)
// router.route('/:id').get(getProductById).put(auth, authorizeRoles('admin','superadmin'), upload.array('images'), updateProduct).delete(auth, authorizeRoles('admin','superadmin'), deleteProduct)
// router.route('/images/:productId').delete(auth, authorizeRoles('admin','superadmin'), deleteProductImage)

// module.exports = router
