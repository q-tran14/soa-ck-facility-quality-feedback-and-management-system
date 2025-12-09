const mongoose = require("mongoose");

const MediaSchema = new mongoose.Schema(
  { 
    originalName:{
      type: String,
      default: null,
    },
    publicId: {
      type: String,
      required: true,
      unique: true,
    },
    url: {
      type: String,
      required: true,
    },
    pdfUrl: {
      type: String,
      default: null,
    },
    resourceType: {
      type: String,
      enum: ["image", "video", "raw"],
      required: true,
    },
    extension: {
      type: String,
      required: true,
    },
    taskId: {
      type: String,
      default: null,
    },
    reportId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Media", MediaSchema);
