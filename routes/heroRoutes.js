const express = require('express')
const router = express.Router()
const {
  getHeroImages,
  updateHeroImages,
  deleteHeroImage,
  createBanner,
  getBanners,
  updateBanner,
  deleteBanner,
} = require('../controllers/heroControllerLocal')
const multer = require('multer')
const authorizeRoles = require('../middleware/roleAuthorization')
const auth = require('../middleware/auth')
const upload = multer({ storage: multer.memoryStorage() })

// Hero Section routes
router.route('/hero').get(getHeroImages).put(auth, authorizeRoles('admin', 'superadmin'), upload.array('images'), updateHeroImages)
router.route('/hero/:imageId').delete(auth, authorizeRoles('admin', 'superadmin'), deleteHeroImage)

// Banner routes
router.route('/banners').get(getBanners).post(auth, authorizeRoles('admin', 'superadmin'), createBanner)
router
  .route('/banners/:id')
  .put(auth, authorizeRoles('admin', 'superadmin'), updateBanner)
  .delete(auth, authorizeRoles('admin', 'superadmin'), deleteBanner)

module.exports = router
