// controllers/blogController.js
const Blog = require('../models/Blog')
const { uploadToS3, deleteFromS3 } = require('../utils/s3')
const Joi = require('joi')
const sharp = require('sharp')
const slugify = require('slugify')
const { isValidObjectId } = require('mongoose').Types

// Helper function to process and upload images
const processAndUploadImage = async (imageFile, pathPrefix = 'blogs') => {
  try {
    const thumbnailBuffer = await sharp(imageFile.buffer)
      .resize(800, 450, {
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

// Process and upload media files from rich text editor content
const processRichTextContent = async (content) => {
  // Regular expression to find base64 encoded images in content
  const base64Regex = /data:image\/(\w+);base64,([^"]+)/g
  let match
  let processedContent = content

  while ((match = base64Regex.exec(content)) !== null) {
    const mimeType = match[1]
    const base64Data = match[2]
    const buffer = Buffer.from(base64Data, 'base64')

    // Create a file object for S3 upload
    const file = {
      buffer,
      mimetype: `image/${mimeType}`,
      originalname: `embedded_image_${Date.now()}.${mimeType}`,
    }

    // Upload to S3
    try {
      const s3Url = await uploadToS3(file, `blogs/embedded/${file.originalname}`)
      // Replace base64 data with S3 URL in content
      processedContent = processedContent.replace(match[0], s3Url)
    } catch (error) {
      console.error('Error uploading embedded image:', error)
    }
  }

  return processedContent
}

// Get all published blogs (for normal users)
const getPublishedBlogs = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query
    const query = { published: true }

    if (search) {
      query.$text = { $search: search }
    }

    const totalBlogs = await Blog.countDocuments(query)

    const blogs = await Blog.find(query)
      .populate('author', 'name')
      .select('-content')
      .sort({ publishedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean()

    res.status(200).json({
      message: 'Blogs fetched successfully',
      data: {
        blogs,
        totalPages: Math.ceil(totalBlogs / limit),
        currentPage: parseInt(page),
        totalBlogs,
      },
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// Get all blogs (including unpublished) - admin only
const getAllBlogs = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query
    const query = {}

    if (search) {
      query.$text = { $search: search }
    }

    const totalBlogs = await Blog.countDocuments(query)

    const blogs = await Blog.find(query)
      .populate('author', 'name')
      .select('-content')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean()

    res.status(200).json({
      message: 'Blogs fetched successfully',
      data: {
        blogs,
        totalPages: Math.ceil(totalBlogs / limit),
        currentPage: parseInt(page),
        totalBlogs,
      },
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// Get a blog by ID or slug
const getBlogByIdOrSlug = async (req, res) => {
  try {
    const param = req.params.idOrSlug
    let query = {}

    // Check if the parameter is an ObjectId
    if (param.match(/^[0-9a-fA-F]{24}$/)) {
      query._id = param
    } else {
      query.slug = param
    }

    const blog = await Blog.findOne(query).populate('author', 'name').lean()

    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' })
    }

    // If the blog is not published and the user is not an admin, deny access
    if (!blog.published && req.user && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Access denied' })
    }

    res.status(200).json({ message: 'Blog fetched successfully', data: blog })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// Create a new blog post
const createBlog = async (req, res) => {
  const schema = Joi.object({
    title: Joi.string().trim().min(3).max(200).required(),
    content: Joi.string().required(),
    summary: Joi.string().trim().max(500),
    tags: Joi.string().trim(),
    published: Joi.boolean(),
  }).options({ abortEarly: false })

  const { error } = schema.validate(req.body)
  if (error) {
    return res.status(400).json({ message: error.details.map((err) => err.message).join(', ') })
  }

  const { title, content, summary, tags, published } = req.body
  try {
    // Generate a slug from the title
    const baseSlug = slugify(title, { lower: true, strict: true })

    // Check if the slug already exists
    const slugExists = await Blog.findOne({ slug: baseSlug })
    const slug = slugExists ? `${baseSlug}-${Date.now().toString().slice(-4)}` : baseSlug

    // Process content to upload embedded images
    const processedContent = await processRichTextContent(content)

    // Process cover image if provided
    let coverImage = ''
    let coverImageThumbnail = ''

    if (req.file) {
      try {
        const result = await processAndUploadImage(req.file)
        coverImage = result.image
        coverImageThumbnail = result.thumbnail
      } catch (error) {
        console.error('Error processing cover image:', error)
        return res.status(500).json({ message: 'Error processing cover image', error: error.message })
      }
    }

    // Parse tags
    const tagsArray = tags ? tags.split(',').map((tag) => tag.trim()) : []

    // Create the blog post
    const blog = await Blog.create({
      title,
      content: processedContent,
      slug,
      summary: summary || title,
      coverImage,
      coverImageThumbnail,
      author: req.user.id,
      published: published || false,
      publishedAt: published ? Date.now() : null,
      tags: tagsArray,
    })

    res.status(201).json({ message: 'Blog created successfully', data: blog })
  } catch (error) {
    console.error('Error in createBlog:', error)
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// Update a blog post
const updateBlog = async (req, res) => {
  const schema = Joi.object({
    title: Joi.string().trim().min(3).max(200),
    content: Joi.string(),
    summary: Joi.string().trim().max(500),
    tags: Joi.string().trim(),
    published: Joi.boolean(),
  }).options({ abortEarly: false })

  const { error } = schema.validate(req.body)
  if (error) {
    return res.status(400).json({ message: error.details.map((err) => err.message).join(', ') })
  }

  const { title, content, summary, tags, published } = req.body
  try {
    const blog = await Blog.findById(req.params.id)

    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' })
    }

    // Update fields if provided
    if (title) {
      blog.title = title

      // Only update slug if title has changed
      if (title !== blog.title) {
        const baseSlug = slugify(title, { lower: true, strict: true })
        const slugExists = await Blog.findOne({ slug: baseSlug, _id: { $ne: blog._id } })
        blog.slug = slugExists ? `${baseSlug}-${Date.now().toString().slice(-4)}` : baseSlug
      }
    }

    if (content) {
      // Process content to upload embedded images
      blog.content = await processRichTextContent(content)
    }

    if (summary !== undefined) blog.summary = summary

    if (tags !== undefined) {
      blog.tags = tags ? tags.split(',').map((tag) => tag.trim()) : []
    }

    // Handle published status change
    if (published !== undefined && blog.published !== published) {
      blog.published = published
      if (published && !blog.publishedAt) {
        blog.publishedAt = Date.now()
      }
    }

    // Process cover image if a new one is provided
    if (req.file) {
      try {
        // Delete existing cover image if it exists
        if (blog.coverImage) {
          await deleteFromS3(blog.coverImage.split('/').pop())
        }
        if (blog.coverImageThumbnail) {
          await deleteFromS3(blog.coverImageThumbnail.split('/').pop())
        }

        // Process and upload new cover image
        const result = await processAndUploadImage(req.file)
        blog.coverImage = result.image
        blog.coverImageThumbnail = result.thumbnail
      } catch (error) {
        console.error('Error processing cover image:', error)
        return res.status(500).json({ message: 'Error processing cover image', error: error.message })
      }
    }

    const updatedBlog = await blog.save()

    res.json({ message: 'Blog updated successfully', data: updatedBlog })
  } catch (error) {
    console.error('Error in updateBlog:', error)
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// Delete a blog post
const deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id)

    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' })
    }

    // Delete cover image if it exists
    if (blog.coverImage) {
      try {
        await deleteFromS3(blog.coverImage.split('/').pop())
      } catch (error) {
        console.error('Error deleting cover image from S3:', error)
      }
    }

    if (blog.coverImageThumbnail) {
      try {
        await deleteFromS3(blog.coverImageThumbnail.split('/').pop())
      } catch (error) {
        console.error('Error deleting cover image thumbnail from S3:', error)
      }
    }

    // Note: Embedded images in content will remain in S3 since they might be
    // shared between multiple blog posts or difficult to extract reliably

    await Blog.deleteOne({ _id: blog._id })

    res.json({ message: 'Blog deleted successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

module.exports = {
  getPublishedBlogs,
  getAllBlogs,
  getBlogByIdOrSlug,
  createBlog,
  updateBlog,
  deleteBlog,
}
