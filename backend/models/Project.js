const mongoose = require("mongoose")

const SiteSchema = new mongoose.Schema(
  {
    plotNo: String,
    sizeSqFt: Number,
    pricePerSqFt: Number,
    totalPrice: Number,
    facing: String
  },
  { _id: false }
)

const NearbySchema = new mongoose.Schema(
  {
    name: String,
    distanceKm: Number
  },
  { _id: false }
)

const BeforeAfterSchema = new mongoose.Schema(
  {
    before: String,
    after: String
  },
  { _id: false }
)

const BudgetSchema = new mongoose.Schema(
  {
    maintenancePerYear: Number,
    registrationEstimatePercent: Number,
    stampDutyPercent: Number
  },
  { _id: false }
)

const TimelineSchema = new mongoose.Schema(
  {
    possession: String,
    developmentPhase: String,
    lastUpdated: String
  },
  { _id: false }
)

const ProjectSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    status: String,
    location: String,
    summary: String,
    details: String,
    storyboardNotes: String,
    coverImageUrl: String,
    gallery: [String],
    mapImageUrl: String,
    videoUrl: String,
    brochureUrl: String,
    bgmUrl: String,
    isPublished: { type: Boolean, default: false },
    languages: [String],
    availableSites: [SiteSchema],
    amenities: [String],
    nearby: [NearbySchema],
    beforeAfter: BeforeAfterSchema,
    mapHighlights: [String],
    budget: BudgetSchema,
    timeline: TimelineSchema
  },
  { timestamps: true }
)

module.exports = mongoose.model("Project", ProjectSchema)
