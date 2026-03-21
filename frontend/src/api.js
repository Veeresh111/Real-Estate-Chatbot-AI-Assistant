import axios from "axios"

const API = import.meta.env.VITE_API_URL || "http://localhost:4000/api"

export async function sendMessage(payload) {
  const res = await axios.post(`${API}/chat`, payload)
  return res.data
}

export async function generateVideo(payload) {
  const res = await axios.post(`${API}/video`, payload)
  return res.data
}

export async function getVideoStatus(videoId) {
  const res = await axios.get(`${API}/video/${videoId}`)
  return res.data
}

export async function generateStoryboard(payload) {
  const res = await axios.post(`${API}/video/storyboard`, payload)
  return res.data
}

export async function createLead(data) {
  const res = await axios.post(`${API}/lead`, data)
  return res.data
}

export async function fetchProjects(options = {}) {
  const params = options.publishedOnly ? { published: "true" } : undefined
  const res = await axios.get(`${API}/projects`, { params })
  return res.data
}

export async function createProject(payload) {
  const res = await axios.post(`${API}/projects`, payload)
  return res.data
}

export async function updateProject(id, payload) {
  const res = await axios.put(`${API}/projects/${id}`, payload)
  return res.data
}

export async function deleteProject(id) {
  const res = await axios.delete(`${API}/projects/${id}`)
  return res.data
}
