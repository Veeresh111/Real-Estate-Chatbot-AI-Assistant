const mongoose = require("mongoose")

const CompanySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    city: String,
    phone: String,
    email: String,
    address: String
  },
  { timestamps: true }
)

module.exports = mongoose.model("Company", CompanySchema)
