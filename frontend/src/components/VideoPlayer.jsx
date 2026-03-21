function VideoPlayer({ video, status }) {
  if (!video && status !== "completed") {
    return (
      <div className="video-placeholder">
        <div className="pulse" />
        <p>{status === "creating" || status === "queued" ? "Generating video..." : "No video yet."}</p>
      </div>
    )
  }

  return (
    <div className="video-frame">
      <video controls src={video} />
    </div>
  )
}

export default VideoPlayer
