const Hero = require('../models/Hero')
const Banner = require('../models/Banner')
const { uploadToS3, deleteFromS3 } = require('../utils/s3')

// Hero Section Controllers
const getHeroImages = async (req, res) => {
  try {
    const hero = await Hero.findOne()
    if (!hero) {
      return res.status(404).json({ message: 'Hero section not found' })
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
        const imageUrl = await uploadToS3(file, `hero/${Date.now() + '_' + file.originalname}`)
        if (imageUrl !== null) (
          hero.images.push(imageUrl)
        )
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

    // Extract the image filename from the URL
    const imageId = req.params.imageId
    const imageUrl = hero.images.find((url) => url.includes(imageId))

    if (!imageUrl) {
      return res.status(404).json({ message: 'Image not found' })
    }

    await deleteFromS3(imageUrl)
    hero.images = hero.images.filter((url) => url !== imageUrl)
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
