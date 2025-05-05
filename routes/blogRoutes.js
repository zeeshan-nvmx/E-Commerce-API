// routes/blogRoutes.js - Complete routes with video support
const express = require('express')
const router = express.Router()
const { getPublishedBlogs, getAllBlogs, getBlogByIdOrSlug, createBlog, updateBlog, deleteBlog } = require('../controllers/blogController')
const multer = require('multer')
const authorizeRoles = require('../middleware/roleAuthorization')
const auth = require('../middleware/auth')
const upload = multer({ storage: multer.memoryStorage() })

// Configure multer to handle multiple file types
const blogUpload = upload.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'video', maxCount: 1 },
])

// Public routes
router.route('/published').get(getPublishedBlogs)
router.route('/published/:idOrSlug').get(getBlogByIdOrSlug)

// Admin-only routes
router.route('/').get(auth, authorizeRoles('admin', 'superadmin'), getAllBlogs)
router.route('/').post(auth, authorizeRoles('admin', 'superadmin'), blogUpload, createBlog)
router.route('/:id').put(auth, authorizeRoles('admin', 'superadmin'), blogUpload, updateBlog)
router.route('/:id').delete(auth, authorizeRoles('admin', 'superadmin'), deleteBlog)

module.exports = router
