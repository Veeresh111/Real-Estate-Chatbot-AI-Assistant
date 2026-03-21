const express = require("express")
const router = express.Router()

const Lead = require("../models/Lead")

router.post("/",async(req,res)=>{

try{

const lead = new Lead(req.body)

await lead.save()

res.json({message:"Lead Saved"})

}catch(err){

res.status(500).json({error:err.message})

}

})

module.exports = router