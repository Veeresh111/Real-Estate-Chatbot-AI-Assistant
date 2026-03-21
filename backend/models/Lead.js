const mongoose = require("mongoose")

const LeadSchema = new mongoose.Schema({

name:String,
email:String,
phone:String,

message:String,

language:String,
budget:String,
siteId:String,
preferredTime:String,

createdAt:{
type:Date,
default:Date.now
}

})

module.exports = mongoose.model("Lead",LeadSchema)
