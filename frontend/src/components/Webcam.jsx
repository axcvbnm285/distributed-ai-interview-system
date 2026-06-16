import { useEffect, useRef, useState, useCallback } from "react";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

// ── Remote feed tile ─────────────────────────────────────────
function RemoteFeed({ peerId, stream, label, isScreen = false }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div className={`relative w-full rounded-xl overflow-hidden bg-[#0a0a0e] border ${isScreen ? "border-violet-500/40" : "border-[#2a2a38]"}`}
      style={{ aspectRatio: "16/9" }}>
      <video ref={videoRef} autoPlay playsInline muted={false}
        className="w-full h-full object-contain" />
      {isScreen && (
        <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-violet-600/80 backdrop-blur-sm px-2 py-1 rounded-full">
          <ScreenIcon className="w-3 h-3 text-white" />
          <span className="text-xs text-white font-medium">Screen</span>
        </div>
      )}
      <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-lg">
        <span className="text-xs text-white font-medium">{label || peerId.slice(0, 6)}</span>
      </div>
    </div>
  );
}

// ── Main Webcam component ─────────────────────────────────────
function Webcam({ username = "You", roomCode, socket, role = "INTERVIEWEE" }) {
  const isInterviewer = role === "INTERVIEWER";

  const localVideoRef      = useRef(null);
  const screenVideoRef     = useRef(null);   // local screen preview
  const localStreamRef     = useRef(null);   // camera+mic stream
  const screenStreamRef    = useRef(null);   // screen share stream
  const pcsRef             = useRef({});     // peerId → RTCPeerConnection
  const pendingCandidatesRef = useRef({});
  const mediaRecorderRef   = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingUrlRef    = useRef(null);

  const [callStatus,   setCallStatus]   = useState("idle");    // idle | loading | active | denied | unavailable
  const [camOn,        setCamOn]        = useState(true);
  const [micOn,        setMicOn]        = useState(true);
  const [remoteFeeds,  setRemoteFeeds]  = useState({});        // peerId → { stream, isScreen }

  // Screen share states
  const [screenSharing,    setScreenSharing]    = useState(false);  // local screen active
  const [screenRequest,    setScreenRequest]    = useState(false);  // interviewee: received request
  const [requestPending,   setRequestPending]   = useState(false);  // interviewer: waiting for accept
  const [requestDeclined,  setRequestDeclined]  = useState(false);  // interviewer: was declined
  const [isRecording,      setIsRecording]      = useState(false);
  const [recordingError,   setRecordingError]   = useState("");

  // ── peer connection helpers ──────────────────────────────

  const clearRecordingUrl = useCallback(() => {
    if (recordingUrlRef.current) {
      URL.revokeObjectURL(recordingUrlRef.current);
      recordingUrlRef.current = null;
    }
  }, []);

  const buildRecordingStream = useCallback(() => {
    const combinedStream = new MediaStream();
    const seenTrackIds = new Set();
    const activeStreams = [
      localStreamRef.current,
      ...Object.values(remoteFeeds).map((feed) => feed?.stream).filter(Boolean),
    ];

    activeStreams.forEach((stream) => {
      stream.getTracks().forEach((track) => {
        if (track.readyState !== "live") return;
        if (seenTrackIds.has(track.id)) return;
        seenTrackIds.add(track.id);
        combinedStream.addTrack(track);
      });
    });

    return combinedStream;
  }, [remoteFeeds]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  }, []);

  const startRecording = useCallback(() => {
    setRecordingError("");

    if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") {
      setRecordingError("This browser does not support recording.");
      return;
    }

    const combinedStream = buildRecordingStream();
    if (combinedStream.getTracks().length === 0) {
      setRecordingError("No active local or remote streams are available to record.");
      return;
    }

    const mimeTypeCandidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];

    const mimeType = mimeTypeCandidates.find((candidate) => MediaRecorder.isTypeSupported?.(candidate)) || "";
    if (!mimeType) {
      setRecordingError("This browser cannot generate WebM recordings.");
      return;
    }

    clearRecordingUrl();
    recordingChunksRef.current = [];

    try {
      const recorder = new MediaRecorder(combinedStream, { mimeType });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setRecordingError("Recording failed. Please try again.");
        setIsRecording(false);
        mediaRecorderRef.current = null;
      };

      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: mimeType });
        recordingChunksRef.current = [];
        mediaRecorderRef.current = null;
        setIsRecording(false);

        if (!blob.size) {
          setRecordingError("Recording finished, but no media was captured.");
          return;
        }

        const downloadUrl = URL.createObjectURL(blob);
        recordingUrlRef.current = downloadUrl;

        const anchor = document.createElement("a");
        anchor.href = downloadUrl;
        anchor.download = `interview-recording-${roomCode}-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);

        window.setTimeout(() => {
          clearRecordingUrl();
        }, 1000);
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      setRecordingError("Unable to start recording on this browser.");
    }
  }, [buildRecordingStream, clearRecordingUrl, roomCode]);

  const syncPeerConnectionTracks = useCallback(async (pc) => {
    if (!pc) return;

    const desiredVideoTrack =
      screenStreamRef.current?.getVideoTracks?.()[0] ||
      localStreamRef.current?.getVideoTracks?.()[0] ||
      null;
    const desiredAudioTrack = localStreamRef.current?.getAudioTracks?.()[0] || null;

    const videoSender = pc.getSenders().find((sender) => sender.track?.kind === "video");
    const audioSender = pc.getSenders().find((sender) => sender.track?.kind === "audio");

    if (desiredVideoTrack) {
      if (videoSender) {
        if (videoSender.track !== desiredVideoTrack) {
          await videoSender.replaceTrack(desiredVideoTrack);
        }
      } else {
        pc.addTrack(desiredVideoTrack, screenStreamRef.current || localStreamRef.current);
      }
    } else if (videoSender) {
      await videoSender.replaceTrack(null);
    }

    if (desiredAudioTrack) {
      if (audioSender) {
        if (audioSender.track !== desiredAudioTrack) {
          await audioSender.replaceTrack(desiredAudioTrack);
        }
      } else if (localStreamRef.current) {
        pc.addTrack(desiredAudioTrack, localStreamRef.current);
      }
    } else if (audioSender) {
      await audioSender.replaceTrack(null);
    }
  }, []);

  const getOrCreatePC = useCallback((peerId) => {
    if (pcsRef.current[peerId]) return pcsRef.current[peerId];

    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socket.emit("webrtc-ice-candidate", { to: peerId, candidate });
    };

    pc.ontrack = ({ streams, track }) => {
      if (!streams?.[0]) return;
      const stream = streams[0];
      // Detect if this is a screen share track by checking the stream id on the sender side
      // We rely on a naming convention: screen streams have a video track with label containing "screen"
      // For simplicity we check if the track is a video with kind "video" and the remote labeled it
      setRemoteFeeds(prev => ({
        ...prev,
        [peerId]: {
          stream,
          // Will be updated to isScreen:true when screenshare-accepted arrives
          isScreen: prev[peerId]?.isScreen || false,
        },
      }));
    };

    pc.onconnectionstatechange = () => {
      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        closePeer(peerId);
      }
    };

    syncPeerConnectionTracks(pc).catch(() => {});

    pcsRef.current[peerId] = pc;
    return pc;
  }, [socket, syncPeerConnectionTracks]);

  const closePeer = (peerId) => {
    pcsRef.current[peerId]?.close();
    delete pcsRef.current[peerId];
    delete pendingCandidatesRef.current[peerId];
    setRemoteFeeds(prev => { const n = { ...prev }; delete n[peerId]; return n; });
  };

  const drainPendingCandidates = async (peerId, pc) => {
    for (const c of pendingCandidatesRef.current[peerId] || []) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
    delete pendingCandidatesRef.current[peerId];
  };

  // Renegotiate after replacing/adding a track
  const renegotiate = async (peerId) => {
    const pc = pcsRef.current[peerId];
    if (!pc) return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("webrtc-offer", { to: peerId, offer });
  };

  // ── socket listeners ─────────────────────────────────────

  useEffect(() => {
    if (!socket) return;

    const onUserJoined = async ({ socketId }) => {
      const pc    = getOrCreatePC(socketId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("webrtc-offer", { to: socketId, offer });
    };

    const onOffer = async ({ from, offer }) => {
      const pc = getOrCreatePC(from);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await drainPendingCandidates(from, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc-answer", { to: from, answer });
    };

    const onAnswer = async ({ from, answer }) => {
      const pc = pcsRef.current[from];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await drainPendingCandidates(from, pc);
      }
    };

    const onIceCandidate = async ({ from, candidate }) => {
      const pc = pcsRef.current[from];
      if (pc && pc.remoteDescription) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      } else {
        if (!pendingCandidatesRef.current[from]) pendingCandidatesRef.current[from] = [];
        pendingCandidatesRef.current[from].push(candidate);
      }
    };

    const onUserLeft = ({ socketId }) => closePeer(socketId);

    // ── Screen share signaling ──

    // Interviewee receives screen share request from interviewer
    const onScreenshareRequest = () => {
      if (!isInterviewer) setScreenRequest(true);
    };

    // Interviewer learns interviewee accepted
    const onScreenshareAccepted = ({ from }) => {
      if (isInterviewer) {
        setRequestPending(false);
        setRequestDeclined(false);
        // Mark that remote feed from this peer will be a screen
        setRemoteFeeds(prev => ({
          ...prev,
          [from]: { ...(prev[from] || {}), isScreen: true },
        }));
      }
    };

    // Interviewer learns interviewee declined
    const onScreenshareDeclined = () => {
      if (isInterviewer) {
        setRequestPending(false);
        setRequestDeclined(true);
        setTimeout(() => setRequestDeclined(false), 4000);
      }
    };

    // Both sides learn screen share stopped
    const onScreenshareStopped = ({ from }) => {
      if (isInterviewer) {
        setRemoteFeeds(prev => ({
          ...prev,
          [from]: { ...(prev[from] || {}), isScreen: false },
        }));
      }
      if (!isInterviewer) {
        setScreenSharing(false);
        setScreenRequest(false);
      }
    };

    socket.on("webrtc-user-joined",    onUserJoined);
    socket.on("webrtc-offer",          onOffer);
    socket.on("webrtc-answer",         onAnswer);
    socket.on("webrtc-ice-candidate",  onIceCandidate);
    socket.on("webrtc-user-left",      onUserLeft);
    socket.on("screenshare-request",   onScreenshareRequest);
    socket.on("screenshare-accepted",  onScreenshareAccepted);
    socket.on("screenshare-declined",  onScreenshareDeclined);
    socket.on("screenshare-stopped",   onScreenshareStopped);

    return () => {
      socket.off("webrtc-user-joined",   onUserJoined);
      socket.off("webrtc-offer",         onOffer);
      socket.off("webrtc-answer",        onAnswer);
      socket.off("webrtc-ice-candidate", onIceCandidate);
      socket.off("webrtc-user-left",     onUserLeft);
      socket.off("screenshare-request",  onScreenshareRequest);
      socket.off("screenshare-accepted", onScreenshareAccepted);
      socket.off("screenshare-declined", onScreenshareDeclined);
      socket.off("screenshare-stopped",  onScreenshareStopped);
    };
  }, [socket, getOrCreatePC, isInterviewer]);

  // ── camera / mic controls ────────────────────────────────

  const startMedia = async () => {
    setCallStatus("loading");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      await Promise.all(Object.values(pcsRef.current).map((pc) => syncPeerConnectionTracks(pc)));
      setCallStatus("active");
      setCamOn(true);
      setMicOn(true);
      socket.emit("webrtc-join", { roomCode });
    } catch (err) {
      setCallStatus(err.name === "NotAllowedError" ? "denied" : "unavailable");
    }
  };

  const stopMedia = () => {
    if (isRecording) stopRecording();
    if (screenSharing) stopScreenShare();
    Object.keys(pcsRef.current).forEach(closePeer);
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    socket.emit("webrtc-leave", { roomCode });
    setCallStatus("idle");
    setCamOn(true);
    setMicOn(true);
    setRemoteFeeds({});
    setScreenRequest(false);
    setRecordingError("");
  };

  const toggleCam = () => {
    const t = localStreamRef.current?.getVideoTracks()[0];
    if (t) { t.enabled = !t.enabled; setCamOn(t.enabled); }
  };

  const toggleMic = () => {
    const t = localStreamRef.current?.getAudioTracks()[0];
    if (t) { t.enabled = !t.enabled; setMicOn(t.enabled); }
  };

  // ── screen share controls ────────────────────────────────

  // INTERVIEWER: send request
  const requestScreenShare = () => {
    setRequestPending(true);
    setRequestDeclined(false);
    socket.emit("screenshare-request", { roomCode });
  };

  // INTERVIEWEE: accept request
  const acceptScreenShare = async () => {
    setScreenRequest(false);
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = screenStream;

      if (screenVideoRef.current) screenVideoRef.current.srcObject = screenStream;

      const screenTrack = screenStream.getVideoTracks()[0];

      if (Object.keys(pcsRef.current).length === 0) {
        socket.emit("webrtc-join", { roomCode });
      }

      for (const [peerId, pc] of Object.entries(pcsRef.current)) {
        await syncPeerConnectionTracks(pc);
        await renegotiate(peerId);
      }

      setScreenSharing(true);
      socket.emit("screenshare-accepted", { roomCode });

      // Auto-stop when browser native "Stop sharing" is clicked
      screenTrack.onended = () => stopScreenShare();
    } catch (err) {
      // User cancelled or denied
      setScreenRequest(false);
      declineScreenShare();
    }
  };

  // INTERVIEWEE: decline request
  const declineScreenShare = () => {
    setScreenRequest(false);
    socket.emit("screenshare-declined", { roomCode });
  };

  // INTERVIEWEE: stop sharing
  const stopScreenShare = async () => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    if (screenVideoRef.current) screenVideoRef.current.srcObject = null;

    for (const [peerId, pc] of Object.entries(pcsRef.current)) {
      await syncPeerConnectionTracks(pc);
      await renegotiate(peerId);
    }

    setScreenSharing(false);
    socket.emit("screenshare-stopped", { roomCode });
  };

  // Cleanup on unload
  useEffect(() => {
    const onUnload = () => {
      stopRecording();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      socket?.emit("webrtc-leave", { roomCode });
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [socket, roomCode, stopRecording]);

  useEffect(() => {
    return () => {
      stopRecording();
      clearRecordingUrl();
    };
  }, [clearRecordingUrl, stopRecording]);

  // ── render ───────────────────────────────────────────────

  const remotePeerIds = Object.keys(remoteFeeds);

  return (
    <div className="flex flex-col gap-3 p-4">

      {/* ── Screen Share Request Banner (Interviewee) ── */}
      {!isInterviewer && screenRequest && (
        <div className="bg-violet-600/15 border border-violet-500/40 rounded-xl p-4 animate-fade-in">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-violet-600/30 flex items-center justify-center shrink-0">
              <ScreenIcon className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-0.5">Screen share requested</p>
              <p className="text-xs text-gray-400">The interviewer has asked you to share your screen.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={acceptScreenShare}
              className="flex-1 flex items-center justify-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold py-2 rounded-lg transition-all">
              <ScreenIcon className="w-3.5 h-3.5" />
              Share Screen
            </button>
            <button onClick={declineScreenShare}
              className="flex-1 flex items-center justify-center gap-1.5 bg-[#1e1e2a] hover:bg-[#2a2a38] border border-[#2a2a38] text-gray-400 text-xs font-semibold py-2 rounded-lg transition-all">
              Decline
            </button>
          </div>
        </div>
      )}

      {/* ── Request Pending / Declined Notice (Interviewer) ── */}
      {isInterviewer && requestPending && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2.5 animate-fade-in">
          <Spinner />
          <p className="text-xs text-amber-400">Waiting for interviewee to accept...</p>
        </div>
      )}
      {isInterviewer && requestDeclined && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5 animate-fade-in">
          <svg className="w-4 h-4 text-red-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          <p className="text-xs text-red-400">Screen share was declined.</p>
        </div>
      )}
      {isInterviewer && recordingError && (
        <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2.5 animate-fade-in">
          <svg className="w-4 h-4 text-yellow-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.93c.75 1.334-.213 2.971-1.742 2.971H4.42c-1.53 0-2.492-1.637-1.743-2.97l5.58-9.93zM11 13a1 1 0 10-2 0 1 1 0 002 0zm-1-6a1 1 0 00-1 1v3a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-xs text-yellow-300">{recordingError}</p>
        </div>
      )}
      {isInterviewer && isRecording && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5 animate-fade-in">
          <span className="text-xs text-red-400 font-semibold">🔴 Recording...</span>
          <p className="text-xs text-red-300">Recording local and remote call streams.</p>
        </div>
      )}

      {/* ── Local screen share preview (Interviewee while sharing) ── */}
      {!isInterviewer && screenSharing && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              <p className="text-xs text-violet-400 font-semibold font-mono">Sharing screen</p>
            </div>
            <button onClick={stopScreenShare}
              className="text-xs text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/50 px-2 py-1 rounded-lg transition-all flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Stop
            </button>
          </div>
          <div className="relative w-full rounded-xl overflow-hidden bg-[#0a0a0e] border border-violet-500/40" style={{ aspectRatio: "16/9" }}>
            <video ref={screenVideoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
            <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-violet-600/80 backdrop-blur-sm px-2 py-1 rounded-full">
              <ScreenIcon className="w-3 h-3 text-white" />
              <span className="text-xs text-white font-medium">Your Screen</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Local camera feed ── */}
      <div>
        <p className="text-xs text-gray-600 mb-1.5 font-mono">You — {username}</p>
        <div className="relative w-full rounded-xl overflow-hidden bg-[#0a0a0e] border border-[#2a2a38]" style={{ aspectRatio: "16/9" }}>
          <video ref={localVideoRef} autoPlay playsInline muted
            className={`w-full h-full object-cover transition-opacity duration-500 ${callStatus === "active" ? "opacity-100" : "opacity-0"}`} />

          {callStatus !== "active" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              {callStatus === "idle" && (
                <>
                  <div className="w-12 h-12 rounded-full bg-[#1e1e2a] border border-[#2a2a38] flex items-center justify-center">
                    <VideoOffIcon className="text-gray-600" />
                  </div>
                  <p className="text-xs text-gray-600">Camera &amp; mic off</p>
                </>
              )}
              {callStatus === "loading" && (
                <>
                  <svg className="w-6 h-6 text-violet-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className="text-xs text-gray-500">Requesting access...</p>
                </>
              )}
              {callStatus === "denied" && (
                <>
                  <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </div>
                  <p className="text-xs text-red-400 text-center px-4">Camera access denied.</p>
                </>
              )}
              {callStatus === "unavailable" && (
                <p className="text-xs text-yellow-400 text-center px-4">No camera/mic found.</p>
              )}
            </div>
          )}

          {callStatus === "active" && (
            <>
              <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs text-white font-medium">LIVE</span>
              </div>
              <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-lg">
                <span className="text-xs text-white font-medium">{username}</span>
              </div>
              <div className="absolute top-2 right-2 flex gap-1">
                {!camOn && <span className="bg-black/60 p-1 rounded-full"><VideoOffIcon className="text-red-400 w-3 h-3" /></span>}
                {!micOn && <span className="bg-black/60 p-1 rounded-full"><MicOffIcon className="text-red-400 w-3 h-3" /></span>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Call controls ── */}
      {callStatus !== "active" ? (
        <button onClick={startMedia} disabled={callStatus === "loading"}
          className="w-full flex items-center justify-center gap-2 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-400 text-xs font-semibold py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
          <VideoOnIcon />
          {callStatus === "loading" ? "Starting..." : "Join with Camera & Mic"}
        </button>
      ) : (
        <div className="flex gap-2">
          <button onClick={toggleCam}
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg border transition-all ${camOn ? "bg-[#1e1e2a] border-[#2a2a38] text-gray-400 hover:border-violet-500/40 hover:text-violet-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
            {camOn ? <VideoOnIcon /> : <VideoOffIcon />}
            {camOn ? "Cam On" : "Cam Off"}
          </button>
          <button onClick={toggleMic}
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg border transition-all ${micOn ? "bg-[#1e1e2a] border-[#2a2a38] text-gray-400 hover:border-violet-500/40 hover:text-violet-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
            {micOn ? <MicOnIcon /> : <MicOffIcon />}
            {micOn ? "Mic On" : "Mic Off"}
          </button>
          <button onClick={stopMedia} title="Leave call"
            className="flex items-center justify-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold px-3 py-2 rounded-lg transition-all">
            <PhoneOffIcon />
          </button>
        </div>
      )}

      {/* ── Screen share button — Interviewer only ── */}
      {isInterviewer && callStatus === "active" && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            onClick={requestScreenShare}
            disabled={requestPending}
            className="w-full flex items-center justify-center gap-2 bg-violet-600/15 hover:bg-violet-600/25 border border-violet-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-violet-400 text-xs font-semibold py-2 rounded-lg transition-all">
            <ScreenIcon className="w-3.5 h-3.5" />
            {requestPending ? "Request sent..." : "Request Screen Share"}
          </button>
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-semibold py-2 rounded-lg transition-all">
              <RecordIcon />
              Start Recording
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-400 border border-red-400/50 text-white text-xs font-semibold py-2 rounded-lg transition-all">
              <StopIcon />
              Stop Recording
            </button>
          )}
        </div>
      )}

      {/* ── Remote feeds ── */}
      {remotePeerIds.length > 0 && (
        <div className="flex flex-col gap-3 mt-1">
          <p className="text-xs text-gray-600 font-mono">Participants ({remotePeerIds.length})</p>
          {remotePeerIds.map(peerId => (
            <RemoteFeed
              key={peerId}
              peerId={peerId}
              stream={remoteFeeds[peerId].stream}
              isScreen={remoteFeeds[peerId].isScreen}
              label={remoteFeeds[peerId].isScreen ? "Screen" : peerId.slice(0, 6)}
            />
          ))}
        </div>
      )}

      {callStatus === "active" && remotePeerIds.length === 0 && (
        <div className="flex items-center gap-2 bg-[#1e1e2a] border border-[#2a2a38] rounded-lg px-3 py-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse shrink-0" />
          <p className="text-xs text-gray-600">Waiting for others to join the call...</p>
        </div>
      )}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────

function ScreenIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

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

function RecordIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="5.5" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
      <rect x="5" y="5" width="10" height="10" rx="1.5" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default Webcam;
