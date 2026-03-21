require("dotenv").config()

const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const path = require("path")

const chatRoutes = require("./routes/chat")
const audioRoutes = require("./routes/audio")
const videoRoutes = require("./routes/video")
const leadRoutes = require("./routes/lead")
const projectRoutes = require("./routes/projects")
const { ensureSeedData } = require("./services/projects")

const app = express()

app.use(cors())
app.use(express.json())

app.use("/uploads", express.static(path.join(__dirname, "uploads")))

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("MongoDB Connected")
    await ensureSeedData()
  })
  .catch((err) => console.log(err))

app.use("/api/chat",chatRoutes)
app.use("/api/audio",audioRoutes)
app.use("/api/video",videoRoutes)
app.use("/api/lead",leadRoutes)
app.use("/api/projects",projectRoutes)

app.get("/",(req,res)=>{
res.send("AI Real Estate Server Running")
})

const PORT = process.env.PORT || 4000

app.listen(PORT,()=>{
console.log("Server running on port "+PORT)
})
