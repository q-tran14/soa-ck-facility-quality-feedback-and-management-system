const asyncHandler = require("express-async-handler");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const Media = require("../models/Media");

// ---------------------- Cloudinary ----------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ---------------------- Multer ----------------------
const upload = multer({ storage: multer.memoryStorage() });

// ---------------------- FILE TYPES ----------------------
const cloudinaryImageVideoAudio = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "avif",
  "heic",
  "tiff",
  "svg",
  "psd",
  "mp4",
  "mov",
  "webm",
  "ogg",
  "avi",
  "flv",
  "wmv",
  "mp3",
  "m4a",
  "flac",
];

const officeExtensions = [
  "doc",
  "docx",
  "dotx",
  "rtf",
  "txt",
  "xls",
  "xlsx",
  "xlsm",
  "ppt",
  "pptx",
  "pptm",
  "pps",
  "ppsx",
  "pdf",
];

// ============================
//     MEDIA SERVICE
// ============================
const mediaService = {
  // ---------------------- UPLOAD ----------------------
  UploadFile: asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const { taskId, reportId } = req.body;

    // Validate owner
    if (!taskId && !reportId)
      return res
        .status(400)
        .json({ message: "taskId or reportId is required" });

    if (taskId && reportId)
      return res
        .status(400)
        .json({ message: "Only one of taskId or reportId allowed" });

    const extension = req.file.originalname.split(".").pop().toLowerCase();
    const isImageVideoAudio = cloudinaryImageVideoAudio.includes(extension);
    const isOffice = officeExtensions.includes(extension);

    // =====================================================
    //  CASE 1: IMAGE / VIDEO / AUDIO (upload_stream)
    // =====================================================
    if (isImageVideoAudio) {
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: "auto" },
        async (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            return res.status(500).json({ message: "Upload failed" });
          }

          const media = await Media.create({
            originalName: req.file.originalname,
            publicId: result.public_id,
            url: result.secure_url,
            pdfUrl: null,
            resourceType: result.resource_type,
            extension,
            provider: "cloudinary",
            taskId: taskId || null,
            reportId: reportId || null,
          });

          return res.json({
            message: "Uploaded to Cloudinary",
            mediaId: media._id,
            url: media.url,
            type: media.resourceType,
            provider: media.provider,
          });
        }
      );

      uploadStream.end(req.file.buffer);
      return;
    }

    // =====================================================
    //  CASE 2: OFFICE DOCUMENT + ASPOSE (convert to PDF)
    // =====================================================
    if (isOffice) {
      try {
        const publicId = `docs/${Date.now()}-${req.file.originalname}`;

        const result = await cloudinary.uploader.upload(
          `data:${req.file.mimetype};base64,${req.file.buffer.toString(
            "base64"
          )}`,
          {
            resource_type: "raw",
            public_id: publicId,
            use_filename: true,
            unique_filename: false,
            raw_convert: "aspose", // 🚀 convert to PDF
          }
        );

        // Cloudinary PDF URL (Aspose creates PDF with .pdf extension)
        const isPdf = extension === "pdf";

        let pdfUrl = null;

        if (isPdf) {
          pdfUrl = result.secure_url.replace("/raw/", "/image/") + ".pdf";
        }

        const media = await Media.create({
          originalName: req.file.originalname,
          publicId: result.public_id,
          url: result.secure_url,
          pdfUrl,
          resourceType: "raw",
          extension,
          provider: "cloudinary-aspose",
          taskId: taskId || null,
          reportId: reportId || null,
        });

        return res.json({
          message: "Uploaded & converted using Aspose",
          mediaId: media._id,
          url: media.url,
          pdfUrl: media.pdfUrl,
          type: media.resourceType,
          provider: media.provider,
        });
      } catch (err) {
        console.error("Aspose upload error:", err);
        return res.status(500).json({ message: "Aspose upload failed" });
      }
    }

    // =====================================================
    //  CASE 3: Unsupported
    // =====================================================
    return res.status(400).json({ message: "Unsupported file type" });
  }),

  // ---------------------- GET ----------------------
  GetFile: asyncHandler(async (req, res) => {
    const { mediaId } = req.params;
    const media = await Media.findById(mediaId);
    if (!media) return res.status(404).json({ message: "Media not found" });

    res.json({
      message: "File fetched",
      originalName: media.originalName,
      url: media.url,
      pdfUrl: media.pdfUrl,
      provider: media.provider,
      type: media.resourceType,
    });
  }),

  // ---------------------- DELETE ----------------------
  DeleteFile: asyncHandler(async (req, res) => {
    const { mediaId } = req.params;
    const media = await Media.findById(mediaId);
    if (!media) return res.status(404).json({ message: "Media not found" });

    try {
      await cloudinary.uploader.destroy(media.publicId, {
        resource_type: media.resourceType,
      });

      await media.deleteOne();

      res.json({
        message: "Deleted",
        provider: media.provider,
      });
    } catch (err) {
      console.error("Delete error:", err);
      res.status(500).json({ message: "Failed to delete" });
    }
  }),
  // ---------------------- GET MEDIA BY TASK ----------------------
  GetMediaByTask: asyncHandler(async (req, res) => {
    const { taskId } = req.params;

    const media = await Media.find({ taskId });

    res.json({
      message: "Fetched media by task",
      count: media.length,
      data: media,
    });
  }),

  // ---------------------- GET MEDIA BY REPORT ----------------------
  GetMediaByReport: asyncHandler(async (req, res) => {
    const { reportId } = req.params;

    const media = await Media.find({ reportId });

    res.json({
      message: "Fetched media by report",
      count: media.length,
      data: media,
    });
  }),
};

module.exports = { mediaService, upload };
