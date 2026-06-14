import { useEffect, useRef, useState, useCallback } from "react";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

// One remote feed tile
function RemoteFeed({ peerId, stream, muted }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-[#0a0a0e] border border-[#2a2a38]" style={{ aspectRatio: "16/9" }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-lg">
        <span className="text-xs text-white font-medium">{peerId.slice(0, 6)}</span>
      </div>
    </div>
  );
}

function Webcam({ username = "You", roomCode, socket }) {
  const localVideoRef  = useRef(null);
  const localStreamRef = useRef(null);          // raw MediaStream
  const pcsRef         = useRef({});            // peerId → RTCPeerConnection
  const pendingCandidatesRef = useRef({});      // peerId → ICECandidate[] (before remote desc)

  const [status,     setStatus]     = useState("idle");   // idle | loading | active | denied | unavailable
  const [camOn,      setCamOn]      = useState(true);
  const [micOn,      setMicOn]      = useState(true);
  const [remoteFeeds, setRemoteFeeds] = useState({});     // peerId → MediaStream

  // ── helpers ──────────────────────────────────────────────

  const getOrCreatePC = useCallback((peerId) => {
    if (pcsRef.current[peerId]) return pcsRef.current[peerId];

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Send ICE candidates to the remote peer via signaling
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit("webrtc-ice-candidate", { to: peerId, candidate });
      }
    };

    // Receive remote tracks → build a MediaStream per peer
    pc.ontrack = ({ streams }) => {
      if (streams && streams[0]) {
        setRemoteFeeds((prev) => ({ ...prev, [peerId]: streams[0] }));
      }
    };

    pc.onconnectionstatechange = () => {
      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        closePeer(peerId);
      }
    };

    // Add local tracks to this connection if stream is already available
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pcsRef.current[peerId] = pc;
    return pc;
  }, [socket]);

  const closePeer = (peerId) => {
    pcsRef.current[peerId]?.close();
    delete pcsRef.current[peerId];
    delete pendingCandidatesRef.current[peerId];
    setRemoteFeeds((prev) => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  };

  const drainPendingCandidates = async (peerId, pc) => {
    const queued = pendingCandidatesRef.current[peerId] || [];
    for (const c of queued) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
    delete pendingCandidatesRef.current[peerId];
  };

  // ── socket signaling listeners ───────────────────────────

  useEffect(() => {
    if (!socket) return;

    // Another peer joined → we (the existing peer) create offer
    const onUserJoined = async ({ socketId }) => {
      const pc = getOrCreatePC(socketId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("webrtc-offer", { to: socketId, offer });
    };

    // We received an offer → send answer
    const onOffer = async ({ from, offer }) => {
      const pc = getOrCreatePC(from);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await drainPendingCandidates(from, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc-answer", { to: from, answer });
    };

    // We received an answer
    const onAnswer = async ({ from, answer }) => {
      const pc = pcsRef.current[from];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await drainPendingCandidates(from, pc);
      }
    };

    // ICE candidate from a peer
    const onIceCandidate = async ({ from, candidate }) => {
      const pc = pcsRef.current[from];
      if (pc && pc.remoteDescription) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      } else {
        // Queue until remote description is set
        if (!pendingCandidatesRef.current[from]) pendingCandidatesRef.current[from] = [];
        pendingCandidatesRef.current[from].push(candidate);
      }
    };

    // A peer left
    const onUserLeft = ({ socketId }) => closePeer(socketId);

    socket.on("webrtc-user-joined",    onUserJoined);
    socket.on("webrtc-offer",          onOffer);
    socket.on("webrtc-answer",         onAnswer);
    socket.on("webrtc-ice-candidate",  onIceCandidate);
    socket.on("webrtc-user-left",      onUserLeft);

    return () => {
      socket.off("webrtc-user-joined",   onUserJoined);
      socket.off("webrtc-offer",         onOffer);
      socket.off("webrtc-answer",        onAnswer);
      socket.off("webrtc-ice-candidate", onIceCandidate);
      socket.off("webrtc-user-left",     onUserLeft);
    };
  }, [socket, getOrCreatePC]);

  // ── camera controls ──────────────────────────────────────

  const startMedia = async () => {
    setStatus("loading");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;

      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      // Add tracks to any already-existing peer connections (late join edge case)
      Object.values(pcsRef.current).forEach((pc) => {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      });

      setStatus("active");
      setCamOn(true);
      setMicOn(true);

      // Tell peers in the room we're ready
      socket.emit("webrtc-join", { roomCode });
    } catch (err) {
      setStatus(err.name === "NotAllowedError" ? "denied" : "unavailable");
    }
  };

  const stopMedia = () => {
    // Close all peer connections
    Object.keys(pcsRef.current).forEach(closePeer);

    // Stop local tracks
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;

    socket.emit("webrtc-leave", { roomCode });

    setStatus("idle");
    setCamOn(true);
    setMicOn(true);
    setRemoteFeeds({});
  };

  const toggleCam = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCamOn(videoTrack.enabled);
    }
  };

  const toggleMic = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicOn(audioTrack.enabled);
    }
  };

  // Cleanup on page unload
  useEffect(() => {
    const onUnload = () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      socket?.emit("webrtc-leave", { roomCode });
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [socket, roomCode]);

  // ── render ───────────────────────────────────────────────

  const remotePeerIds = Object.keys(remoteFeeds);

  return (
    <div className="flex flex-col gap-3 p-4">

      {/* Local feed */}
      <div>
        <p className="text-xs text-gray-600 mb-1.5 font-mono">You — {username}</p>
        <div className="relative w-full rounded-xl overflow-hidden bg-[#0a0a0e] border border-[#2a2a38]" style={{ aspectRatio: "16/9" }}>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transition-opacity duration-500 ${status === "active" ? "opacity-100" : "opacity-0"}`}
          />

          {/* Overlay when not active */}
          {status !== "active" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              {status === "idle" && (
                <>
                  <div className="w-12 h-12 rounded-full bg-[#1e1e2a] border border-[#2a2a38] flex items-center justify-center">
                    <VideoOffIcon className="text-gray-600" />
                  </div>
                  <p className="text-xs text-gray-600">Camera &amp; mic off</p>
                </>
              )}
              {status === "loading" && (
                <>
                  <svg className="w-6 h-6 text-violet-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className="text-xs text-gray-500">Requesting access...</p>
                </>
              )}
              {status === "denied" && (
                <>
                  <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </div>
                  <p className="text-xs text-red-400 text-center px-4">Access denied.<br />Check browser permissions.</p>
                </>
              )}
              {status === "unavailable" && (
                <p className="text-xs text-yellow-400 text-center px-4">No camera/mic found.</p>
              )}
            </div>
          )}

          {/* Live badge + name */}
          {status === "active" && (
            <>
              <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs text-white font-medium">LIVE</span>
              </div>
              <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-lg">
                <span className="text-xs text-white font-medium">{username}</span>
              </div>
              {/* cam/mic muted indicators */}
              <div className="absolute top-2 right-2 flex gap-1">
                {!camOn && (
                  <span className="bg-black/60 p-1 rounded-full">
                    <VideoOffIcon className="text-red-400 w-3 h-3" />
                  </span>
                )}
                {!micOn && (
                  <span className="bg-black/60 p-1 rounded-full">
                    <MicOffIcon className="text-red-400 w-3 h-3" />
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Controls */}
      {status !== "active" ? (
        <button
          onClick={startMedia}
          disabled={status === "loading"}
          className="w-full flex items-center justify-center gap-2 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-400 text-xs font-semibold py-2.5 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <VideoOnIcon />
          {status === "loading" ? "Starting..." : "Join with Camera & Mic"}
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={toggleCam}
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg border transition-all duration-200 ${
              camOn
                ? "bg-[#1e1e2a] border-[#2a2a38] text-gray-400 hover:border-violet-500/40 hover:text-violet-400"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}
          >
            {camOn ? <VideoOnIcon /> : <VideoOffIcon />}
            {camOn ? "Cam On" : "Cam Off"}
          </button>
          <button
            onClick={toggleMic}
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg border transition-all duration-200 ${
              micOn
                ? "bg-[#1e1e2a] border-[#2a2a38] text-gray-400 hover:border-violet-500/40 hover:text-violet-400"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}
          >
            {micOn ? <MicOnIcon /> : <MicOffIcon />}
            {micOn ? "Mic On" : "Mic Off"}
          </button>
          <button
            onClick={stopMedia}
            className="flex items-center justify-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold px-3 py-2 rounded-lg transition-all duration-200"
            title="Leave call"
          >
            <PhoneOffIcon />
          </button>
        </div>
      )}

      {/* Remote feeds */}
      {remotePeerIds.length > 0 && (
        <div className="flex flex-col gap-3 mt-1">
          <p className="text-xs text-gray-600 font-mono">Participants ({remotePeerIds.length})</p>
          {remotePeerIds.map((peerId) => (
            <RemoteFeed key={peerId} peerId={peerId} stream={remoteFeeds[peerId]} muted={false} />
          ))}
        </div>
      )}

      {status === "active" && remotePeerIds.length === 0 && (
        <div className="flex items-center gap-2 bg-[#1e1e2a] border border-[#2a2a38] rounded-lg px-3 py-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse shrink-0" />
          <p className="text-xs text-gray-600">Waiting for others to join the call...</p>
        </div>
      )}
    </div>
  );
}

// ── Icon components ──────────────────────────────────────────

function VideoOnIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
    </svg>
  );
}

function VideoOffIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h1m4 0h3a2 2 0 012 2v1M3 8v8a2 2 0 002 2h8a2 2 0 002-2v-3M3 3l18 18" />
    </svg>
  );
}

function MicOnIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 3a4 4 0 014 4v4a4 4 0 01-8 0V7a4 4 0 014-4z" />
    </svg>
  );
}

function MicOffIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
    </svg>
  );
}

function PhoneOffIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
    </svg>
  );
}

export default Webcam;
