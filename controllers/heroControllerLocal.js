const Hero = require('../models/Hero')
const Banner = require('../models/Banner')
const { uploadToLocal, deleteFromLocal } = require('../utils/local-storage')
const path = require('path')

// Hero Section Controllers
const getHeroImages = async (req, res) => {
  try {
    const hero = await Hero.findOne()
    if (!hero) {
      return res.status(404).json({ data: [], message: 'Hero section not found' })
    }
    res.json({ data: hero.images, message: 'Hero images successfully fetched' })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const updateHeroImages = async (req, res) => {
  try {
    let hero = await Hero.findOne()
    if (!hero) {
      hero = new Hero({ images: [] })
    }

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileName = `${Date.now()}_${file.originalname}`
        const imagePath = await uploadToLocal(file, fileName)
        if (imagePath !== null) {
          hero.images.push(imagePath)
        }
      }
      await hero.save()
      res.json({ data: hero.images, message: 'Hero images successfully updated' })
    } else {
      res.status(400).json({ message: 'No images provided for update' })
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const deleteHeroImage = async (req, res) => {
  try {
    const hero = await Hero.findOne()
    if (!hero) {
      return res.status(404).json({ message: 'Hero section not found' })
    }

    const imageId = req.params.imageId
    const imagePath = hero.images.find((path) => path.includes(imageId))

    if (!imagePath) {
      return res.status(404).json({ message: 'Image not found' })
    }

    await deleteFromLocal(path.basename(imagePath))
    hero.images = hero.images.filter((path) => path !== imagePath)
    await hero.save()

    res.json({ message: 'Hero image deleted successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

// Banner Controllers
const createBanner = async (req, res) => {
  const { text, linkUrl, backgroundColor, textColor } = req.body

  try {
    const banner = await Banner.create({
      text,
      linkUrl,
      backgroundColor,
      textColor,
    })
    res.status(201).json({ data: banner, message: 'Banner created successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const getBanners = async (req, res) => {
  try {
    const banners = await Banner.find()
    res.json({ data: banners, message: 'Banners fetched successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const updateBanner = async (req, res) => {
  const { text, linkUrl, backgroundColor, textColor } = req.body

  try {
    const banner = await Banner.findById(req.params.id)
    if (!banner) {
      return res.status(404).json({ message: 'Banner not found' })
    }

    banner.text = text || banner.text
    banner.linkUrl = linkUrl || banner.linkUrl
    banner.backgroundColor = backgroundColor || banner.backgroundColor
    banner.textColor = textColor || banner.textColor

    const updatedBanner = await banner.save()
    res.json({ data: updatedBanner, message: 'Banner updated successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

const deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id)

    if (!banner) {
      return res.status(404).json({ message: 'Banner not found' })
    }

    res.json({ message: 'Banner deleted successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

module.exports = {
  getHeroImages,
  updateHeroImages,
  deleteHeroImage,
  createBanner,
  getBanners,
  updateBanner,
  deleteBanner,
}
